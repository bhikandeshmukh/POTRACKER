import { ShipmentService } from '@/lib/services/shipment.service';
import { Shipment } from '@/lib/types';
import { Timestamp } from 'firebase/firestore';

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

describe('ShipmentService', () => {
  let service: ShipmentService;

  beforeEach(() => {
    service = new ShipmentService();
    jest.clearAllMocks();
  });

  describe('createShipment', () => {
    it('should create shipment with audit logging', async () => {
      const mockShipmentData = {
        poNumber: 'PO-2024-001',
        poId: 'po-1',
        vendorId: 'vendor-1',
        vendorName: 'Test Vendor',
        invoiceNumber: 'INV-001',
        shipmentDate: { seconds: 1234567890, nanoseconds: 0 } as Timestamp,
        expectedDeliveryDate: { seconds: 1234567890, nanoseconds: 0 } as Timestamp,
        status: 'Prepared' as const,
        totalAmount: 10000,
        lineItems: [
          {
            itemName: 'Test Item',
            quantity: 10,
            unitPrice: 1000,
            total: 10000
          }
        ]
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
          id: 'shipment-1',
          ...mockShipmentData
        }
      });

      const result = await service.createShipment(mockShipmentData, mockCreatedBy);

      expect(createSpy).toHaveBeenCalledWith({
        ...mockShipmentData,
        createdBy_uid: mockCreatedBy.uid,
        createdBy_name: mockCreatedBy.name
      });
      expect(result.success).toBe(true);
    });

    it('should handle creation errors', async () => {
      const mockShipmentData = {
        poNumber: 'PO-2024-001',
        poId: 'po-1',
        vendorId: 'vendor-1',
        vendorName: 'Test Vendor',
        invoiceNumber: 'INV-001',
        shipmentDate: { seconds: 1234567890, nanoseconds: 0 } as Timestamp,
        expectedDeliveryDate: { seconds: 1234567890, nanoseconds: 0 } as Timestamp,
        status: 'Prepared' as const,
        totalAmount: 10000,
        lineItems: []
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

      const result = await service.createShipment(mockShipmentData, mockCreatedBy);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Creation failed');
    });
  });

  describe('updateShipmentStatus', () => {
    it('should update shipment status with audit logging', async () => {
      const mockShipment = {
        id: 'shipment-1',
        poNumber: 'PO-2024-001',
        status: 'Prepared' as const,
        totalAmount: 10000
      };

      const mockUpdatedBy = {
        uid: 'user-1',
        name: 'Admin User',
        role: 'Admin'
      };

      // Mock findById to return current shipment
      jest.spyOn(service, 'findById').mockResolvedValue({
        success: true,
        data: mockShipment
      });

      // Mock update to return success
      jest.spyOn(service, 'update').mockResolvedValue({
        success: true,
        data: {
          ...mockShipment,
          status: 'Shipped'
        }
      });

      const result = await service.updateShipmentStatus(
        'shipment-1',
        'Shipped',
        mockUpdatedBy,
        'TRACK123'
      );

      expect(result.success).toBe(true);
    });

    it('should handle shipment not found', async () => {
      const mockUpdatedBy = {
        uid: 'user-1',
        name: 'Admin User',
        role: 'Admin'
      };

      // Mock findById to return not found
      jest.spyOn(service, 'findById').mockResolvedValue({
        success: false,
        error: 'Document not found'
      });

      const result = await service.updateShipmentStatus(
        'non-existent',
        'Shipped',
        mockUpdatedBy
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('Shipment not found');
    });
  });

  describe('getShipmentsByPO', () => {
    it('should return shipments for specific PO', async () => {
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

      await service.getShipmentsByPO('PO-2024-001');

      expect(findManySpy).toHaveBeenCalledWith({
        where: [{ field: 'poNumber', operator: '==', value: 'PO-2024-001' }],
        orderBy: 'shipmentDate',
        orderDirection: 'desc'
      });
    });
  });

  describe('getShipmentsByStatus', () => {
    it('should return shipments with specific status', async () => {
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

      await service.getShipmentsByStatus('Shipped');

      expect(findManySpy).toHaveBeenCalledWith({
        where: [{ field: 'status', operator: '==', value: 'Shipped' }],
        orderBy: 'shipmentDate',
        orderDirection: 'desc'
      });
    });
  });

  describe('getShipmentStats', () => {
    it('should calculate shipment statistics', async () => {
      const mockShipments = [
        { status: 'Prepared', totalAmount: 1000 },
        { status: 'Shipped', totalAmount: 2000 },
        { status: 'Delivered', totalAmount: 3000 },
        { status: 'Cancelled', totalAmount: 500 }
      ];

      jest.spyOn(service, 'findMany').mockResolvedValue({
        success: true,
        data: {
          data: mockShipments,
          total: 4,
          page: 1,
          limit: 10,
          hasMore: false
        }
      });

      const result = await service.getShipmentStats();

      expect(result.success).toBe(true);
      expect(result.data).toEqual({
        total: 4,
        prepared: 1,
        shipped: 1,
        inTransit: 0,
        delivered: 1,
        cancelled: 1,
        totalValue: 6500
      });
    });

    it('should handle fetch errors', async () => {
      jest.spyOn(service, 'findMany').mockResolvedValue({
        success: false,
        error: 'Database error'
      });

      const result = await service.getShipmentStats();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Failed to fetch shipments');
    });
  });

  describe('searchShipments', () => {
    it('should filter shipments by search term', async () => {
      const mockShipments = [
        {
          id: '1',
          poNumber: 'PO-2024-001',
          invoiceNumber: 'INV-001',
          trackingNumber: 'TRACK123',
          carrier: 'DHL'
        },
        {
          id: '2',
          poNumber: 'PO-2024-002',
          invoiceNumber: 'INV-002',
          trackingNumber: 'TRACK456',
          carrier: 'FedEx'
        }
      ];

      jest.spyOn(service, 'findMany').mockResolvedValue({
        success: true,
        data: {
          data: mockShipments,
          total: 2,
          page: 1,
          limit: 10,
          hasMore: false
        }
      });

      const result = await service.searchShipments('PO-2024-001');

      expect(result.success).toBe(true);
      expect(result.data?.data).toHaveLength(1);
      expect(result.data?.data[0].poNumber).toBe('PO-2024-001');
    });
  });
});