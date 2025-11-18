# PO Tracker - Purchase Order Management System

A comprehensive web-based Purchase Order (PO) tracking and management system built with Next.js, React, and Firebase. This application streamlines the entire purchase order lifecycle from creation to delivery.

[![Build Status](https://img.shields.io/badge/build-passing-brightgreen)]()
[![Version](https://img.shields.io/badge/version-1.0.0-blue)]()
[![License](https://img.shields.io/badge/license-MIT-green)]()

---

## 🚀 Features

### Core Functionality
- **Purchase Order Management**: Create, edit, view, and track purchase orders
- **Vendor Management**: Maintain vendor database with contact information
- **Transporter Management**: Track delivery partners and logistics
- **User Management**: Role-based access control (Admin, Manager, Employee)
- **Real-time Updates**: Live data synchronization across all users
- **Status Tracking**: Track PO status from Pending → Approved → Shipped → Received
- **Audit Logs**: Complete activity tracking for compliance and monitoring

### Advanced Features
- **Dashboard Analytics**: KPI cards, charts, and real-time metrics
- **Excel-like Table Views**: Resizable columns, pagination, sorting
- **Email Integration**: Send PO notifications and updates
- **Shipment Management**: Track deliveries and partial shipments
- **Return Orders**: Handle product returns with full tracking
- **Comments System**: Collaborative notes on purchase orders
- **Approval Workflow**: Multi-level approval process
- **Data Import/Export**: Bulk operations and reporting
- **Advanced Search & Filters**: Find POs quickly with multiple criteria
- **Permissions System**: Granular role and user-based permissions

### User Interface
- **Responsive Design**: Works on desktop, tablet, and mobile
- **Consistent Theme**: Unified styling across all pages
- **Dark/Light Mode Support**: Adaptive color schemes
- **Intuitive Navigation**: Sidebar navigation with role-based menus
- **Loading States**: Smooth user experience with loading indicators

---

## �️ Tecehnology Stack

- **Frontend**: Next.js 14, React 18, TypeScript
- **Styling**: Tailwind CSS with custom theme system
- **Backend**: Firebase (Firestore, Authentication, Storage)
- **Icons**: Lucide React
- **Charts**: Recharts
- **Date Handling**: date-fns
- **State Management**: React Context API + React Query
- **Form Validation**: Custom validation hooks

---

## 📋 Prerequisites

Before running this application, make sure you have:

- Node.js (v18 or higher)
- npm or yarn package manager
- Firebase project with Firestore and Authentication enabled
- Git for version control

---

## 🔧 Installation

### 1. Clone the repository
```bash
git clone <repository-url>
cd po-tracker
```

### 2. Install dependencies
```bash
npm install
```

### 3. Set up Firebase configuration

Create a `.env.local` file in the root directory:
```env
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_auth_domain
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_storage_bucket
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
```

### 4. Deploy Firebase configuration

```bash
# Deploy Firestore indexes
firebase deploy --only firestore:indexes

# Deploy security rules
firebase deploy --only firestore:rules
```

### 5. Run the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 👥 User Roles & Permissions

### Admin
- Full system access
- User management (create, edit, delete users)
- Vendor and transporter management
- View all purchase orders
- Access audit logs
- System configuration
- Permissions management

### Manager
- Approve/reject purchase orders
- View team purchase orders
- Vendor and transporter management
- Update shipment status
- Access to analytics dashboard
- Create and manage return orders

### Employee
- Create purchase orders
- View own purchase orders
- Basic vendor information access
- Submit POs for approval
- Track shipment status

---

## 📱 Application Structure

```
src/
├── app/                    # Next.js app router pages
│   ├── dashboard/         # Main dashboard
│   ├── pos/              # Purchase order pages
│   ├── vendors/          # Vendor management
│   ├── transporters/     # Transporter management
│   ├── admin/            # Admin panel
│   └── audit-logs/       # Audit trail
├── components/           # Reusable UI components
├── contexts/            # React context providers
├── hooks/               # Custom React hooks
├── lib/                 # Utility functions and Firebase
│   ├── firebase.ts      # Firebase configuration
│   ├── firestore.ts     # Database operations
│   ├── logger.ts        # Logging utility
│   ├── errors.ts        # Error handling
│   └── permissions.ts   # Permission management
├── styles/              # Global styles and theme
└── types/               # TypeScript type definitions
```

---

## 🎨 Theme System

The application uses a centralized theme system located in `src/styles/theme.ts`:

- **Typography**: Consistent font sizes and weights
- **Icons**: Standardized icon sizes (small, medium, large, extra-large)
- **Spacing**: Uniform padding and margins
- **Colors**: Predefined color schemes for different states
- **Responsive**: Mobile-first responsive design

---

## 🔐 Security Features

- **Authentication**: Firebase Authentication with email/password
- **Authorization**: Role-based access control
- **Data Validation**: Client and server-side validation
- **Audit Trail**: Complete activity logging
- **Secure Rules**: Firestore security rules implementation
- **Error Handling**: Consistent error handling with custom error classes
- **Logging**: Professional logging system with environment-based levels

---

## 📊 Data Models

### Purchase Order
```typescript
interface PurchaseOrder {
  id: string;
  poNumber: string;
  vendorId: string;
  vendorName: string;
  orderDate: Timestamp;
  expectedDeliveryDate: Timestamp;
  status: 'Pending' | 'Approved' | 'Rejected' | 'Shipped' | 'Received' | 'Partial';
  lineItems: LineItem[];
  totalAmount: number;
  createdBy_uid: string;
  createdBy_name: string;
}
```

### Vendor
```typescript
interface Vendor {
  id?: string;
  name: string;
  contactPerson: string;
  phone: string;
  email?: string;
  gst?: string;
  address?: string;
}
```

### Transporter
```typescript
interface Transporter {
  id?: string;
  name: string;
  contactPerson: string;
  phone: string;
  email?: string;
  vehicleNumber?: string;
  vehicleType?: string;
  driverName?: string;
  driverPhone?: string;
}
```

---

## 🚀 Deployment

### Vercel (Recommended)
1. Connect your GitHub repository to Vercel
2. Add environment variables in Vercel dashboard
3. Deploy automatically on push to main branch

### Other Platforms
- **Netlify**: Configure build settings and environment variables
- **Firebase Hosting**: Use Firebase CLI for deployment
- **AWS Amplify**: Connect repository and configure build settings

---

## 🧪 Testing

```bash
# Run build to check for errors
npm run build

# Run linting
npm run lint
```

---

## 📈 Performance Optimization

- **Code Splitting**: Automatic route-based code splitting
- **Image Optimization**: Next.js Image component
- **Caching**: Firebase caching and browser caching
- **Lazy Loading**: Components loaded on demand
- **Firestore Indexes**: 6 composite indexes for optimized queries
- **Modern TypeScript**: ES2020 target for better performance

---

## 🔧 Configuration

### Environment Variables
```env
# Firebase Configuration
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
```

### Firebase Collections Structure
```
/users/{userId}
/vendors/{vendorId}
/transporters/{transporterId}
/purchaseOrders/{poId}
/returnOrders/{roId}
/shipments/{shipmentId}
/auditLogs/{logId}
```

---

## 🐛 Troubleshooting

### Common Issues

1. **Firebase Connection Issues**
   - Verify environment variables
   - Check Firebase project configuration
   - Ensure Firestore rules are properly set

2. **Authentication Problems**
   - Clear browser cache and cookies
   - Check Firebase Authentication settings
   - Verify user roles in Firestore

3. **Build Errors**
   - Clear .next folder: `Remove-Item -Recurse -Force .next`
   - Reinstall dependencies: `npm install`
   - Check TypeScript errors: `npm run build`

---

## 📝 Recent Updates

### Version 1.0.0 (November 2025)

#### Critical Fixes:
- ✅ Fixed build errors and missing exports
- ✅ Removed security vulnerabilities (plain text passwords)
- ✅ Protected Firebase credentials
- ✅ Cleaned up architecture (removed 80+ lines of complex code)

#### New Features:
- ✅ Professional logging system (`src/lib/logger.ts`)
- ✅ Consistent error handling (`src/lib/errors.ts`)
- ✅ Firestore indexes for optimized queries
- ✅ Updated TypeScript to ES2020

#### Performance Improvements:
- ✅ 50-70% faster queries with proper indexes
- ✅ Simplified data structure for better performance
- ✅ Modern JavaScript features for smaller bundles

For detailed information, see:
- `COMPLETE_FIX_REPORT.md` - Comprehensive fix report
- `ROOT_CAUSE_ANALYSIS.md` - Detailed issue analysis

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🤝 Support

For support and questions:
- Create an issue in the GitHub repository
- Check the documentation files
- Review existing issues for solutions

---

## 🎯 Roadmap

### Upcoming Features
- [ ] Mobile app (React Native)
- [ ] Advanced reporting and analytics
- [ ] Integration with accounting systems
- [ ] Barcode scanning for inventory
- [ ] Multi-language support
- [ ] API for third-party integrations
- [ ] Pagination for large datasets
- [ ] Document ID migration to auto-generated IDs

---

## 👨‍💻 Developer

**Bhikan Deshmukh**
- Email: [thebhikandeshmukh@gmail.com](mailto:thebhikandeshmukh@gmail.com)

---

## 🙏 Acknowledgments

Built with modern web technologies:
- Next.js for the framework
- Firebase for backend services
- Tailwind CSS for styling
- React Query for data management
- Lucide React for icons

---

**Built with ❤️ by Bhikan Deshmukh using Next.js and Firebase**

---

## 📚 Documentation

- **Quick Start**: See installation section above
- **Deployment Guide**: `FIX_SUMMARY.md`
- **Complete Report**: `COMPLETE_FIX_REPORT.md`
- **Issue Analysis**: `ROOT_CAUSE_ANALYSIS.md`

---

**Status**: ✅ Production Ready | **Version**: 1.0.0 | **Last Updated**: November 2025
