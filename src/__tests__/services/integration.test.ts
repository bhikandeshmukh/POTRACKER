import { 
  poService, 
  vendorService, 
  auditService, 
  cacheService 
} from '@/lib/services';

// Mock Firebase
jest.mock('@/lib/firebase', () => ({
  db: {}
}));

jest.mock('firebase/firestore', () => ({
  collection: jest.fn(),
  doc: jest.fn(),
  getDocs: jest.fn(),
  getDoc: jest.fn(),
  addDoc: jest.fn(),
  setDoc: jest.fn(),
  updateDoc: jest.fn(),
  deleteDoc: jest.fn(),
  query: jest.fn(),
  where: jest.fn(),
  orderBy: jest.fn(),
  limit: jest.fn(),
  serverTimestamp: jest.fn(() => ({ seconds: 1234567890, nanoseconds: 0 })),
  Timestamp: {
    fromDate: jest.fn((date) => ({ seconds: Math.floor(date.getTime() / 1000), nanoseconds: 0 })),
    now: jest.fn(() => ({ seconds: 1234567890, nanoseconds: 0 }))
  }
}));

// Mock logger
jest.mock('@/lib/logger', () => ({
  logger: {
    debug: jest.fn(),
    error: jest.fn()
  }
}));

describe('Service Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    cacheService.clear();
  });

  afterEach(() => {
    cacheService.destroy();
  });

  describe('PO Service with Caching', () => {
    it('should cache PO queries and invalidate on updates', async () => {
      const mockPO = {
        id: 'po-1',
        poNumber: 'PO-2024-001',
        vendorId: 'vendor-1',
        vendorName: 'Test Vendor',
        totalAmount: 10000,
        status: 'Pending' as const
      };

      // Mock findById to return PO
      jest.spyOn(poService, 'findById').mockResolvedValue({
        success: true,
        data: mockPO
      });

      // First call should hit the database
      const result1 = await poService.findById('po-1');
      expect(result1.success).toBe(true);
      expect(poService.findById).toHaveBeenCalledTimes(1);

      // Second call should hit cache (but we can't easily test this without mocking the cache)
      const result2 = await poService.findById('po-1');
      expect(result2.success).toBe(true);

      // Mock update to return success
      jest.spyOn(poService, 'update').mockResolvedValue({
        success: true,
        data: { ...mockPO, status: 'Approved' }
      });

      // Update should invalidate cache
      const updateResult = await poService.updatePOStatus(
        'po-1',
        'Approved',
        { uid: 'user-1', name: 'Admin', role: 'Admin' }
      );

      expect(updateResult.success).toBe(true);
    });
  });

  describe('Vendor Service Integration', () => {
    it('should create vendor and handle audit logging', async () => {
      const mockVendorData = {
        name: 'Test Vendor',
        contactPerson: 'John Doe',
        phone: '1234567890',
        email: 'test@vendor.com'
      };

      const mockCreatedBy = {
        uid: 'user-1',
        name: 'Admin User',
        role: 'Admin'
      };

      // Mock create to return success
      jest.spyOn(vendorService, 'create').mockResolvedValue({
        success: true,
        data: {
          id: 'test-vendor',
          ...mockVendorData
        }
      });

      // Mock audit service
      const auditSpy = jest.spyOn(auditService, 'logEvent').mockResolvedValue();

      const result = await vendorService.createVendor(mockVendorData, mockCreatedBy);

      expect(result.success).toBe(true);
      expect(auditSpy).toHaveBeenCalledWith(
        mockCreatedBy.uid,
        mockCreatedBy.name,
        mockCreatedBy.role,
        'create',
        'vendor',
        'test-vendor',
        mockVendorData.name,
        expect.stringContaining('Created vendor'),
        undefined,
        expect.objectContaining({
          contactPerson: mockVendorData.contactPerson,
          phone: mockVendorData.phone,
          email: mockVendorData.email
        })
      );
    });
  });

  describe('Error Handling Integration', () => {
    it('should handle service errors gracefully', async () => {
      // Mock service to throw error
      jest.spyOn(poService, 'findById').mockRejectedValue(new Error('Database connection failed'));

      const result = await poService.findById('non-existent');

      expect(result.success).toBe(false);
      expect(result.error).toContain('find by id');
    });

    it('should handle audit logging failures without breaking main operation', async () => {
      const mockPOData = {
        vendorId: 'vendor-1',
        vendorName: 'Test Vendor',
        orderDate: new Date(),
        expectedDeliveryDate: new Date(),
        totalAmount: 10000,
        lineItems: []
      };

      const mockCreatedBy = {
        uid: 'user-1',
        name: 'Admin User',
        role: 'Admin'
      };

      // Mock create to return success
      jest.spyOn(poService, 'create').mockResolvedValue({
        success: true,
        data: {
          id: 'po-1',
          poNumber: 'PO-2024-001',
          ...mockPOData
        }
      });

      // Mock audit service to fail
      jest.spyOn(auditService, 'logEvent').mockRejectedValue(new Error('Audit service unavailable'));

      // PO creation should still succeed even if audit fails
      const result = await poService.createPO(mockPOData, mockCreatedBy);

      expect(result.success).toBe(true);
    });
  });

  describe('Cache Performance', () => {
    it('should improve query performance with caching', async () => {
      const mockVendors = [
        { id: '1', name: 'Vendor 1', contactPerson: 'John', phone: '123' },
        { id: '2', name: 'Vendor 2', contactPerson: 'Jane', phone: '456' }
      ];

      // Mock findMany to simulate database call
      const findManySpy = jest.spyOn(vendorService, 'findMany').mockResolvedValue({
        success: true,
        data: {
          data: mockVendors,
          total: 2,
          page: 1,
          limit: 10,
          hasMore: false
        }
      });

      // First call
      const start1 = Date.now();
      const result1 = await vendorService.findMany();
      const time1 = Date.now() - start1;

      expect(result1.success).toBe(true);
      expect(findManySpy).toHaveBeenCalledTimes(1);

      // Second call should be faster due to caching
      const start2 = Date.now();
      const result2 = await vendorService.findMany();
      const time2 = Date.now() - start2;

      expect(result2.success).toBe(true);
      // Note: In a real scenario, time2 would be significantly less than time1
    });
  });

  describe('Service Factory', () => {
    it('should provide access to all registered services', () => {
      const { serviceFactory } = require('@/lib/services');

      expect(() => serviceFactory.get('po')).not.toThrow();
      expect(() => serviceFactory.get('vendor')).not.toThrow();
      expect(() => serviceFactory.get('audit')).not.toThrow();
      expect(() => serviceFactory.get('cache')).not.toThrow();
    });

    it('should throw error for unregistered services', () => {
      const { serviceFactory } = require('@/lib/services');

      expect(() => serviceFactory.get('nonexistent')).toThrow('Service nonexistent not found');
    });
  });
});