import { LucideIcon } from 'lucide-react';

interface ModernButtonProps {
  children: React.ReactNode;
  icon?: LucideIcon;
  variant?: 'primary' | 'secondary' | 'search';
  onClick?: () => void;
  className?: string;
  disabled?: boolean;
  type?: 'button' | 'submit';
}

export default function ModernButton({ 
  children, 
  icon: Icon, 
  variant = 'secondary', 
  onClick, 
  className = '',
  disabled = false,
  type = 'button'
}: ModernButtonProps) {
  const baseStyles = 'flex items-center space-x-2 px-4 py-2.5 rounded-xl font-medium transition-all duration-200 border';
  
  const variants = {
    primary: 'bg-blue-600 text-white border-blue-600 hover:bg-blue-700 shadow-sm',
    secondary: 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50 shadow-sm',
    search: 'bg-white text-gray-500 border-gray-300 hover:border-gray-400 w-full justify-start'
  };

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`${baseStyles} ${variants[variant]} ${disabled ? 'opacity-50 cursor-not-allowed' : ''} ${className}`}
    >
      {Icon && <Icon className="size-4" />}
      <span>{children}</span>
    </button>
  );
}