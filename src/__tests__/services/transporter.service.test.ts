import { TransporterService } from '@/lib/services/transporter.service';
import { Transporter } from '@/lib/types';

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
  serverTimestamp: jest.fn(() => ({ seconds: 1234567890, nanoseconds: 0 }))
}));

// Mock audit service
jest.mock('@/lib/services/audit.service', () => ({
  auditService: {
    logEvent: jest.fn().mockResolvedValue(undefined)
  }
}));

// Mock cache service
jest.mock('@/lib/services/cache.service', () => ({
  cacheService: {
    get: jest.fn(),
    set: jest.fn(),
    invalidatePattern: jest.fn()
  }
}));

// Mock logger
jest.mock('@/lib/logger', () => ({
  logger: {
    debug: jest.fn(),
    error: jest.fn()
  }
}));

describe('TransporterService', () => {
  let service: TransporterService;

  beforeEach(() => {
    service = new TransporterService();
    jest.clearAllMocks();
  });

  describe('transporterNameToDocId', () => {
    it('should convert transporter name to valid document ID', () => {
      const testCases = [
        { input: 'ABC Transport Ltd.', expected: 'abc-transport-ltd' },
        { input: 'XYZ Logistics & Co.', expected: 'xyz-logistics-co' },
        { input: 'Fast-Delivery_123', expected: 'fast-delivery-123' },
        { input: '  Multiple   Spaces  ', expected: 'multiple-spaces' }
      ];

      testCases.forEach(({ input, expected }) => {
        const result = service['transporterNameToDocId'](input);
        expect(result).toBe(expected);
      });
    });
  });

  describe('createTransporter', () => {
    it('should create transporter with audit logging', async () => {
      const mockTransporterData = {
        name: 'Test Transport',
        contactPerson: 'John Driver',
        phone: '1234567890',
        vehicleNumber: 'TN01AB1234',
        vehicleType: 'Truck',
        active: true
      };

      const mockCreatedBy = {
        uid: 'user-1',
        name: 'Admin User',
        role: 'Admin'
      };

      // Mock the create method to return success
      const createSpy = jest.spyOn(service, 'create').mockResolvedValue({
        success: true,
        data: {
          id: 'test-transport',
          ...mockTransporterData
        }
      });

      const result = await service.createTransporter(mockTransporterData, mockCreatedBy);

      expect(createSpy).toHaveBeenCalledWith(mockTransporterData, 'test-transport');
      expect(result.success).toBe(true);
    });

    it('should handle creation errors', async () => {
      const mockTransporterData = {
        name: 'Test Transport',
        contactPerson: 'John Driver',
        phone: '1234567890',
        vehicleNumber: 'TN01AB1234',
        vehicleType: 'Truck',
        active: true
      };

      const mockCreatedBy = {
        uid: 'user-1',
        name: 'Admin User',
        role: 'Admin'
      };

      // Mock the create method to return error
      jest.spyOn(service, 'create').mockResolvedValue({
        success: false,
        error: 'Creation failed'
      });

      const result = await service.createTransporter(mockTransporterData, mockCreatedBy);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Creation failed');
    });
  });

  describe('searchTransporters', () => {
    it('should filter transporters by name', async () => {
      const mockTransporters = [
        {
          id: '1',
          name: 'ABC Transport',
          contactPerson: 'John Doe',
          phone: '1234567890',
          vehicleNumber: 'TN01AB1234',
          vehicleType: 'Truck',
          active: true
        },
        {
          id: '2',
          name: 'XYZ Logistics',
          contactPerson: 'Jane Smith',
          phone: '0987654321',
          vehicleNumber: 'TN02CD5678',
          vehicleType: 'Van',
          active: true
        }
      ];

      // Mock findMany to return transporters
      jest.spyOn(service, 'findMany').mockResolvedValue({
        success: true,
        data: {
          data: mockTransporters,
          total: 2,
          page: 1,
          limit: 10,
          hasMore: false
        }
      });

      const result = await service.searchTransporters('ABC');

      expect(result.success).toBe(true);
      expect(result.data?.data).toHaveLength(1);
      expect(result.data?.data[0].name).toBe('ABC Transport');
    });

    it('should search by contact person', async () => {
      const mockTransporters = [
        {
          id: '1',
          name: 'ABC Transport',
          contactPerson: 'John Doe',
          phone: '1234567890',
          vehicleNumber: 'TN01AB1234',
          vehicleType: 'Truck',
          active: true
        }
      ];

      jest.spyOn(service, 'findMany').mockResolvedValue({
        success: true,
        data: {
          data: mockTransporters,
          total: 1,
          page: 1,
          limit: 10,
          hasMore: false
        }
      });

      const result = await service.searchTransporters('john');

      expect(result.success).toBe(true);
      expect(result.data?.data).toHaveLength(1);
    });

    it('should search by vehicle number', async () => {
      const mockTransporters = [
        {
          id: '1',
          name: 'ABC Transport',
          contactPerson: 'John Doe',
          phone: '1234567890',
          vehicleNumber: 'TN01AB1234',
          vehicleType: 'Truck',
          active: true
        }
      ];

      jest.spyOn(service, 'findMany').mockResolvedValue({
        success: true,
        data: {
          data: mockTransporters,
          total: 1,
          page: 1,
          limit: 10,
          hasMore: false
        }
      });

      const result = await service.searchTransporters('TN01AB');

      expect(result.success).toBe(true);
      expect(result.data?.data).toHaveLength(1);
    });

    it('should return empty results for no matches', async () => {
      const mockTransporters = [
        {
          id: '1',
          name: 'ABC Transport',
          contactPerson: 'John Doe',
          phone: '1234567890',
          vehicleNumber: 'TN01AB1234',
          vehicleType: 'Truck',
          active: true
        }
      ];

      jest.spyOn(service, 'findMany').mockResolvedValue({
        success: true,
        data: {
          data: mockTransporters,
          total: 1,
          page: 1,
          limit: 10,
          hasMore: false
        }
      });

      const result = await service.searchTransporters('nonexistent');

      expect(result.success).toBe(true);
      expect(result.data?.data).toHaveLength(0);
    });
  });

  describe('getActiveTransporters', () => {
    it('should return only active transporters', async () => {
      const findManySpy = jest.spyOn(service, 'findMany').mockResolvedValue({
        success: true,
        data: {
          data: [],
          total: 0,
          page: 1,
          limit: 10,
          hasMore: false
        }
      });

      await service.getActiveTransporters();

      expect(findManySpy).toHaveBeenCalledWith({
        where: [{ field: 'active', operator: '==', value: true }],
        orderBy: 'name',
        orderDirection: 'asc'
      });
    });
  });
});