import { 
  collection, 
  doc, 
  getDocs, 
  getDoc, 
  addDoc, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  orderBy, 
  limit,
  Timestamp,
  serverTimestamp,
  QueryConstraint
} from 'firebase/firestore';
import { db } from '../firebase';
import { BaseEntity, QueryOptions, ApiResponse, PaginatedResponse, AppError } from '../types';
import { logger } from '../logger';
import { cacheService } from './cache.service';
import { performanceService } from './performance.service';
import { errorTrackingService } from './error-tracking.service';
import { retryService } from './retry.service';

export abstract class BaseService<T extends BaseEntity> {
  protected collectionName: string;

  constructor(collectionName: string) {
    this.collectionName = collectionName;
    
    // Wrap methods with performance monitoring and retry logic
    this.findById = this.wrapWithRetryAndPerformance('findById', this.findById.bind(this));
    this.findMany = this.wrapWithRetryAndPerformance('findMany', this.findMany.bind(this));
    this.create = this.wrapWithRetryAndPerformance('create', this.create.bind(this));
    this.update = this.wrapWithRetryAndPerformance('update', this.update.bind(this));
    this.delete = this.wrapWithRetryAndPerformance('delete', this.delete.bind(this));
  }

  // Wrap method with both retry logic and performance monitoring
  private wrapWithRetryAndPerformance<TArgs extends any[], TReturn>(
    operation: string,
    fn: (...args: TArgs) => Promise<TReturn>
  ) {
    // First wrap with performance monitoring
    const performanceWrapped = performanceService.measurePerformance(
      this.collectionName,
      operation,
      fn
    );

    // Then wrap with retry logic
    return retryService.wrapServiceMethod(
      this.collectionName,
      operation,
      performanceWrapped,
      {
        maxAttempts: 3,
        baseDelay: 1000,
        retryCondition: (error: any) => {
          // Retry on network errors, timeouts, and Firebase unavailable errors
          const message = error.message?.toLowerCase() || '';
          const code = error.code?.toLowerCase() || '';
          
          return message.includes('network') || 
                 message.includes('timeout') || 
                 message.includes('connection') ||
                 code.includes('unavailable') ||
                 code.includes('deadline-exceeded');
        }
      }
    );
  }

  protected getCollection() {
    return collection(db, this.collectionName);
  }

  protected getDocRef(id: string) {
    return doc(db, this.collectionName, id);
  }

  protected buildQuery(options?: QueryOptions): QueryConstraint[] {
    const constraints: QueryConstraint[] = [];

    if (options?.where) {
      options.where.forEach(condition => {
        constraints.push(where(condition.field, condition.operator, condition.value));
      });
    }

    if (options?.orderBy) {
      constraints.push(orderBy(options.orderBy, options.orderDirection || 'desc'));
    }

    if (options?.limit) {
      constraints.push(limit(options.limit));
    }

    return constraints;
  }

  protected handleError(error: any, operation: string, userId?: string, userRole?: string): AppError {
    // Track the error
    errorTrackingService.trackError(error, {
      operation,
      service: this.collectionName,
      userId,
      userRole,
      timestamp: new Date()
    });

    logger.error(`${operation} failed in ${this.collectionName}`, error);
    
    return {
      code: error.code || 'UNKNOWN_ERROR',
      message: error.message || `Failed to ${operation}`,
      details: error
    };
  }

  // Cache key generators
  protected getCacheKey(operation: string, params?: any): string {
    const baseKey = `${this.collectionName}:${operation}`;
    if (params) {
      const paramStr = typeof params === 'string' ? params : JSON.stringify(params);
      return `${baseKey}:${paramStr}`;
    }
    return baseKey;
  }

  protected invalidateCache(pattern?: string): void {
    const cachePattern = pattern || `${this.collectionName}:`;
    cacheService.invalidatePattern(cachePattern);
  }

  async findById(id: string, useCache: boolean = true): Promise<ApiResponse<T>> {
    const cacheKey = this.getCacheKey('findById', id);
    
    // Try cache first
    if (useCache) {
      const cached = cacheService.get<ApiResponse<T>>(cacheKey);
      if (cached) {
        return cached;
      }
    }

    try {
      const docRef = this.getDocRef(id);
      const docSnap = await getDoc(docRef);
      
      const result: ApiResponse<T> = docSnap.exists() 
        ? {
            success: true,
            data: { id: docSnap.id, ...docSnap.data() } as T
          }
        : {
            success: false,
            error: 'Document not found'
          };

      // Cache successful results
      if (useCache && result.success) {
        cacheService.set(cacheKey, result, 2 * 60 * 1000); // 2 minutes for single documents
      }
      
      return result;
    } catch (error) {
      return {
        success: false,
        error: this.handleError(error, 'find by id').message
      };
    }
  }

  async findMany(options?: QueryOptions, useCache: boolean = true): Promise<ApiResponse<PaginatedResponse<T>>> {
    const cacheKey = this.getCacheKey('findMany', options);
    
    // Try cache first
    if (useCache) {
      const cached = cacheService.get<ApiResponse<PaginatedResponse<T>>>(cacheKey);
      if (cached) {
        return cached;
      }
    }

    try {
      const constraints = this.buildQuery(options);
      const q = query(this.getCollection(), ...constraints);
      const snapshot = await getDocs(q);
      
      const data = snapshot.docs.map(doc => ({ 
        id: doc.id, 
        ...doc.data() 
      } as T));

      const result: ApiResponse<PaginatedResponse<T>> = {
        success: true,
        data: {
          data,
          total: data.length,
          page: 1,
          limit: options?.limit || data.length,
          hasMore: false // TODO: Implement proper pagination
        }
      };

      // Cache successful results
      if (useCache) {
        cacheService.set(cacheKey, result, 1 * 60 * 1000); // 1 minute for lists
      }

      return result;
    } catch (error) {
      return {
        success: false,
        error: this.handleError(error, 'find many').message
      };
    }
  }

  async create(data: Omit<T, 'id' | 'createdAt' | 'updatedAt'>, customId?: string): Promise<ApiResponse<T>> {
    try {
      const entityData = {
        ...data,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      let docRef;
      if (customId) {
        docRef = this.getDocRef(customId);
        await setDoc(docRef, entityData);
      } else {
        docRef = await addDoc(this.getCollection(), entityData);
      }

      // Invalidate cache after successful creation
      this.invalidateCache();

      return {
        success: true,
        data: { id: docRef.id, ...entityData } as T
      };
    } catch (error) {
      return {
        success: false,
        error: this.handleError(error, 'create').message
      };
    }
  }

  async update(id: string, data: Partial<Omit<T, 'id' | 'createdAt'>>): Promise<ApiResponse<T>> {
    try {
      const docRef = this.getDocRef(id);
      const updateData = {
        ...data,
        updatedAt: serverTimestamp()
      };
      
      await updateDoc(docRef, updateData);
      
      // Invalidate cache after successful update
      this.invalidateCache();
      
      // Get updated document (bypass cache to get fresh data)
      const result = await this.findById(id, false);
      return result;
    } catch (error) {
      return {
        success: false,
        error: this.handleError(error, 'update').message
      };
    }
  }

  async delete(id: string): Promise<ApiResponse<void>> {
    try {
      const docRef = this.getDocRef(id);
      await deleteDoc(docRef);
      
      // Invalidate cache after successful deletion
      this.invalidateCache();
      
      return {
        success: true
      };
    } catch (error) {
      return {
        success: false,
        error: this.handleError(error, 'delete').message
      };
    }
  }

  async exists(id: string): Promise<boolean> {
    try {
      const docRef = this.getDocRef(id);
      const docSnap = await getDoc(docRef);
      return docSnap.exists();
    } catch (error) {
      logger.error(`Exists check failed for ${id} in ${this.collectionName}`, error);
      return false;
    }
  }

  async count(options?: QueryOptions): Promise<number> {
    try {
      const result = await this.findMany(options);
      return result.data?.total || 0;
    } catch (error) {
      logger.error(`Count failed in ${this.collectionName}`, error);
      return 0;
    }
  }
}