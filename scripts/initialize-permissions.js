import admin from 'firebase-admin';
import serviceAccount from '../serviceAccountKey.json' assert { type: 'json' };

// Initialize Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

// Default permissions for each role
const DEFAULT_PERMISSIONS = {
  Admin: {
    role: 'Admin',
    permissions: [
      // All permissions
      'po.view', 'po.create', 'po.edit', 'po.delete', 'po.approve', 'po.reject',
      'vendor.view', 'vendor.create', 'vendor.edit', 'vendor.delete',
      'user.view', 'user.create', 'user.edit', 'user.delete',
      'shipment.view', 'shipment.create', 'shipment.edit', 'shipment.delete',
      'report.view', 'report.export', 'report.compliance',
      'settings.view', 'settings.edit', 'permissions.manage',
      'audit.view', 'audit.export'
    ],
    description: 'Full system access with all permissions',
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedBy: 'System'
  },
  Manager: {
    role: 'Manager',
    permissions: [
      'po.view', 'po.create', 'po.edit', 'po.approve', 'po.reject',
      'vendor.view', 'vendor.create', 'vendor.edit',
      'user.view',
      'shipment.view', 'shipment.create', 'shipment.edit',
      'report.view', 'report.export', 'report.compliance',
      'audit.view'
    ],
    description: 'Management level access with approval rights',
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedBy: 'System'
  },
  Employee: {
    role: 'Employee',
    permissions: [
      'po.view', 'po.create', 'po.edit',
      'vendor.view',
      'shipment.view',
      'report.view'
    ],
    description: 'Basic employee access for daily operations',
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedBy: 'System'
  }
};

/**
* Initializes default role permissions in Firestore and logs summaries
* @example
* initializePermissions()
* undefined
* @returns {Promise<void>} Resolves when all permissions are written to Firestore or rejects on error
**/
async function initializePermissions() {
  try {
    console.log('Initializing role permissions in Firestore...\n');

    const entries = Object.entries(DEFAULT_PERMISSIONS);
    await Promise.all(entries.map(async ([role, permissions]) => {
      console.log(`Setting up permissions for ${role}...`);
      
      await db.collection('rolePermissions').doc(role).set(permissions);
      
      console.log(`✅ ${role} permissions initialized`);
      console.log(`   - ${permissions.permissions.length} permissions granted`);
      console.log(`   - ${permissions.description}\n`);
    }));

    console.log('✅ All role permissions initialized successfully!');
    console.log('\nPermissions Summary:');
    console.log(`- Admin: ${DEFAULT_PERMISSIONS.Admin.permissions.length} permissions`);
    console.log(`- Manager: ${DEFAULT_PERMISSIONS.Manager.permissions.length} permissions`);
    console.log(`- Employee: ${DEFAULT_PERMISSIONS.Employee.permissions.length} permissions`);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error initializing permissions:', error);
    process.exit(1);
  }
}

// Run the initialization
initializePermissions();
