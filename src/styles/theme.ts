// Global Theme Configuration for consistent styling across all pages

export const theme = {
  // Typography
  typography: {
    // Page titles
    pageTitle: 'text-lg font-semibold text-gray-900',
    
    // Section headings
    sectionHeading: 'text-base font-semibold text-gray-900 mb-4',
    
    // Card titles
    cardTitle: 'text-sm font-medium text-gray-900',
    
    // Descriptions
    description: 'text-sm text-gray-600',
    
    // Small text
    smallText: 'text-xs text-gray-500',
    
    // KPI values
    kpiValue: 'text-base sm:text-lg md:text-xl font-bold text-gray-900',
    
    // KPI titles
    kpiTitle: 'text-xs font-medium text-gray-600',
  },
  
  // Icons
  icons: {
    // Small icons (buttons, inline)
    small: 'w-3.5 h-3.5 sm:w-4 sm:h-4',
    
    // Medium icons (KPI cards, section headers)
    medium: 'w-4 h-4 sm:w-5 sm:h-5',
    
    // Large icons (main actions)
    large: 'w-5 h-5 sm:w-6 sm:h-6',
    
    // Extra large icons (hero sections)
    extraLarge: 'w-6 h-6 sm:w-8 sm:h-8',
  },
  
  // Spacing
  spacing: {
    // Card padding - optimized for tablet
    cardPadding: 'p-3 sm:p-4 md:p-5 lg:p-6',
    
    // Section padding - optimized for tablet
    sectionPadding: 'p-4 sm:p-5 md:p-6 lg:p-8',
    
    // Page padding - optimized for tablet
    pagePadding: 'p-4 sm:p-5 md:p-6 lg:p-8',
    
    // Button padding - optimized for tablet
    buttonPadding: 'px-4 py-2.5 sm:px-5 sm:py-3 md:px-6 md:py-3',
    
    // Small button padding - optimized for tablet
    smallButtonPadding: 'px-3 py-1.5 sm:px-4 sm:py-2',
  },
  
  // Tablet-specific optimizations
  tablet: {
    // Touch-friendly sizes
    minTouchTarget: 'min-h-[44px] min-w-[44px]',
    
    // Grid layouts
    grid: {
      twoColumn: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-2',
      threeColumn: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
      fourColumn: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4',
    },
    
    // Typography
    text: {
      base: 'text-base sm:text-lg',
      small: 'text-sm sm:text-base',
      large: 'text-lg sm:text-xl md:text-2xl',
    },
    
    // Spacing
    spacing: {
      tight: 'space-y-2 sm:space-y-3',
      normal: 'space-y-3 sm:space-y-4 md:space-y-5',
      loose: 'space-y-4 sm:space-y-5 md:space-y-6',
    }
  },
  
  // Layout
  layout: {
    // Card base
    card: 'bg-white rounded-lg shadow-sm border border-gray-200',
    
    // Grid gaps
    gridGap: 'gap-2 sm:gap-3 md:gap-4',
    
    // Section margins
    sectionMargin: 'mb-4 md:mb-5',
  },
  
  // Buttons
  buttons: {
    // Primary button
    primary: 'bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed',
    
    // Secondary button
    secondary: 'bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition',
    
    // Success button
    success: 'bg-green-600 text-white rounded-lg hover:bg-green-700 transition',
    
    // Danger button
    danger: 'bg-red-600 text-white rounded-lg hover:bg-red-700 transition',
  },
  
  // Colors for KPI cards
  colors: {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    yellow: 'bg-yellow-50 text-yellow-600',
    red: 'bg-red-50 text-red-600',
    purple: 'bg-purple-50 text-purple-600',
    orange: 'bg-orange-50 text-orange-600',
    gray: 'bg-gray-50 text-gray-600',
  }
};

// Helper function to get consistent styling
export const getThemeClasses = {
  pageTitle: () => theme.typography.pageTitle,
  sectionHeading: () => theme.typography.sectionHeading,
  cardTitle: () => theme.typography.cardTitle,
  description: () => theme.typography.description,
  smallText: () => theme.typography.smallText,
  kpiValue: () => theme.typography.kpiValue,
  kpiTitle: () => theme.typography.kpiTitle,
  
  icon: (size: 'small' | 'medium' | 'large' | 'extraLarge' = 'medium') => theme.icons[size],
  
  card: () => theme.layout.card,
  cardPadding: () => theme.spacing.cardPadding,
  sectionPadding: () => theme.spacing.sectionPadding,
  pagePadding: () => theme.spacing.pagePadding,
  buttonPadding: () => theme.spacing.buttonPadding,
  smallButtonPadding: () => theme.spacing.smallButtonPadding,
  
  gridGap: () => theme.layout.gridGap,
  sectionMargin: () => theme.layout.sectionMargin,
  
  button: (type: 'primary' | 'secondary' | 'success' | 'danger' = 'primary') => theme.buttons[type],
  
  color: (color: keyof typeof theme.colors) => theme.colors[color],
};