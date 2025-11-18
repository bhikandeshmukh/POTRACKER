# PO Tracker - Purchase Order Management System

A comprehensive web-based Purchase Order (PO) tracking and management system built with Next.js, React, and Firebase. This application streamlines the entire purchase order lifecycle from creation to delivery.

## 🚀 Features

### Core Functionality
- **Purchase Order Management**: Create, edit, view, and track purchase orders
- **Vendor Management**: Maintain vendor database with contact information
- **User Management**: Role-based access control (Admin, Manager, Employee)
- **Real-time Updates**: Live data synchronization across all users
- **Status Tracking**: Track PO status from Pending → Approved → Shipped → Received
- **Audit Logs**: Complete activity tracking for compliance and monitoring

### Advanced Features
- **Dashboard Analytics**: KPI cards, charts, and real-time metrics
- **Excel-like Table Views**: Resizable columns, pagination, sorting
- **Email Integration**: Send PO notifications and updates
- **Shipment Management**: Track deliveries and partial shipments
- **Comments System**: Collaborative notes on purchase orders
- **Approval Workflow**: Multi-level approval process
- **Data Import/Export**: Bulk operations and reporting
- **Advanced Search & Filters**: Find POs quickly with multiple criteria

### User Interface
- **Responsive Design**: Works on desktop, tablet, and mobile
- **Consistent Theme**: Unified styling across all pages
- **Dark/Light Mode Support**: Adaptive color schemes
- **Intuitive Navigation**: Sidebar navigation with role-based menus
- **Loading States**: Smooth user experience with loading indicators

## 🛠️ Technology Stack

- **Frontend**: Next.js 14, React 18, TypeScript
- **Styling**: Tailwind CSS with custom theme system
- **Backend**: Firebase (Firestore, Authentication, Storage)
- **Icons**: Lucide React
- **Charts**: Recharts
- **Date Handling**: date-fns
- **State Management**: React Context API
- **Form Validation**: Custom validation hooks

## 📋 Prerequisites

Before running this application, make sure you have:

- Node.js (v18 or higher)
- npm or yarn package manager
- Firebase project with Firestore and Authentication enabled
- Git for version control

## 🔧 Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd po-tracker
   ```

2. **Install dependencies**
   ```bash
   npm install
   # or
   yarn install
   ```

3. **Set up Firebase configuration**
   
   Create a `.env.local` file in the root directory:
   ```env
   NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_auth_domain
   NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
   NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_storage_bucket
   NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
   NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
   ```

4. **Configure Firebase Security Rules**
   
   Set up Firestore security rules for proper data access control.

5. **Run the development server**
   ```bash
   npm run dev
   # or
   yarn dev
   ```

6. **Open your browser**
   
   Navigate to `http://localhost:3000`

## 👥 User Roles & Permissions

### Admin
- Full system access
- User management (create, edit, delete users)
- Vendor management
- View all purchase orders
- Access audit logs
- System configuration

### Manager
- Approve/reject purchase orders
- View team purchase orders
- Vendor management
- Update shipment status
- Access to analytics dashboard

### Employee
- Create purchase orders
- View own purchase orders
- Basic vendor information access
- Submit POs for approval

## 📱 Application Structure

```
src/
├── app/                    # Next.js app router pages
│   ├── dashboard/         # Main dashboard
│   ├── pos/              # Purchase order pages
│   ├── vendors/          # Vendor management
│   ├── admin/            # Admin panel
│   └── audit-logs/       # Audit trail
├── components/           # Reusable UI components
├── contexts/            # React context providers
├── hooks/               # Custom React hooks
├── lib/                 # Utility functions and Firebase
├── styles/              # Global styles and theme
└── types/               # TypeScript type definitions
```

## 🎨 Theme System

The application uses a centralized theme system located in `src/styles/theme.ts`:

- **Typography**: Consistent font sizes and weights
- **Icons**: Standardized icon sizes (small, medium, large, extra-large)
- **Spacing**: Uniform padding and margins
- **Colors**: Predefined color schemes for different states
- **Responsive**: Mobile-first responsive design

## 🔐 Security Features

- **Authentication**: Firebase Authentication with email/password
- **Authorization**: Role-based access control
- **Data Validation**: Client and server-side validation
- **Audit Trail**: Complete activity logging
- **Secure Rules**: Firestore security rules implementation

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
  status: 'Pending' | 'Approved' | 'Rejected' | 'Shipped' | 'Received';
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

### User
```typescript
interface User {
  id: string;
  name: string;
  email: string;
  role: 'Admin' | 'Manager' | 'Employee';
}
```

## 🚀 Deployment

### Vercel (Recommended)
1. Connect your GitHub repository to Vercel
2. Add environment variables in Vercel dashboard
3. Deploy automatically on push to main branch

### Other Platforms
- **Netlify**: Configure build settings and environment variables
- **Firebase Hosting**: Use Firebase CLI for deployment
- **AWS Amplify**: Connect repository and configure build settings

## 🧪 Testing

```bash
# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Generate coverage report
npm run test:coverage
```

## 📈 Performance Optimization

- **Code Splitting**: Automatic route-based code splitting
- **Image Optimization**: Next.js Image component
- **Caching**: Firebase caching and browser caching
- **Lazy Loading**: Components loaded on demand
- **Bundle Analysis**: Webpack bundle analyzer

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

# Optional: Analytics
NEXT_PUBLIC_GA_MEASUREMENT_ID=
```

### Firebase Collections Structure
```
/users/{userId}
/vendors/{vendorId}
/pos/{poId}
/auditLogs/{logId}
/shipments/{shipmentId}
```

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
   - Clear node_modules and reinstall
   - Check TypeScript errors
   - Verify all imports are correct

## 📝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Guidelines
- Follow TypeScript best practices
- Use the established theme system
- Write meaningful commit messages
- Add proper error handling
- Include JSDoc comments for functions

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🤝 Support

For support and questions:
- Create an issue in the GitHub repository
- Check the documentation
- Review existing issues for solutions

## 🎯 Roadmap

### Upcoming Features
- [ ] Mobile app (React Native)
- [ ] Advanced reporting and analytics
- [ ] Integration with accounting systems
- [ ] Barcode scanning for inventory
- [ ] Multi-language support
- [ ] API for third-party integrations

### Version History
- **v1.0.0** - Initial release with core PO management
- **v1.1.0** - Added dashboard analytics and charts
- **v1.2.0** - Implemented theme system and responsive design
- **v1.3.0** - Added audit logs and advanced search

## 👨‍💻 Developer

**Bhikan Deshmukh**
- Email: [thebhikandeshmukh@gmail.com](mailto:thebhikandeshmukh@gmail.com)

---

**Built with ❤️ by Bhikan Deshmukh using Next.js and Firebase**