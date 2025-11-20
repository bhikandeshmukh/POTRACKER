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

export abstract class BaseService<T extends BaseEntity> {
  protected collectionName: string;

  constructor(collectionName: string) {
    this.collectionName = collectionName;
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

  protected handleError(error: any, operation: string): AppError {
    logger.error(`${operation} failed in ${this.collectionName}`, error);
    return {
      code: error.code || 'UNKNOWN_ERROR',
      message: error.message || `Failed to ${operation}`,
      details: error
    };
  }

  async findById(id: string): Promise<ApiResponse<T>> {
    try {
      const docRef = this.getDocRef(id);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        return {
          success: true,
          data: { id: docSnap.id, ...docSnap.data() } as T
        };
      }
      
      return {
        success: false,
        error: 'Document not found'
      };
    } catch (error) {
      return {
        success: false,
        error: this.handleError(error, 'find by id').message
      };
    }
  }

  async findMany(options?: QueryOptions): Promise<ApiResponse<PaginatedResponse<T>>> {
    try {
      const constraints = this.buildQuery(options);
      const q = query(this.getCollection(), ...constraints);
      const snapshot = await getDocs(q);
      
      const data = snapshot.docs.map(doc => ({ 
        id: doc.id, 
        ...doc.data() 
      } as T));

      return {
        success: true,
        data: {
          data,
          total: data.length,
          page: 1,
          limit: options?.limit || data.length,
          hasMore: false // TODO: Implement proper pagination
        }
      };
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
      
      // Get updated document
      const result = await this.findById(id);
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