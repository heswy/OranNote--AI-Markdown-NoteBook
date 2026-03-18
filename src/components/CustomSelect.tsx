import React, { useState, useRef, useEffect } from 'react'
import { ChevronDown, Check } from 'lucide-react'

interface SelectOption {
  value: string
  label: string
  disabled?: boolean
}

interface CustomSelectProps {
  value: string
  options: SelectOption[]
  onChange: (value: string) => void
  placeholder?: string
  className?: string
  disabled?: boolean
}

export const CustomSelect: React.FC<CustomSelectProps> = ({
  value,
  options,
  onChange,
  placeholder = '请选择...',
  className = '',
  disabled = false
}) => {
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  
  const selectedOption = options.find(opt => opt.value === value)
  
  // 点击外部关闭
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])
  
  const handleSelect = (optionValue: string) => {
    onChange(optionValue)
    setIsOpen(false)
  }
  
  return (
    <div 
      ref={containerRef}
      className={`relative ${className}`}
    >
      {/* 触发器 */}
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={`
          w-full flex items-center justify-between px-3 py-2 
          bg-bg-surface border border-border rounded-lg
          text-left text-sm transition-all duration-fast
          ${disabled 
            ? 'opacity-50 cursor-not-allowed' 
            : 'cursor-pointer hover:border-border-hover'
          }
          ${isOpen ? 'border-primary-500 ring-2 ring-primary-500/20' : ''}
        `}
      >
        <span className={selectedOption ? 'text-text-primary' : 'text-text-tertiary'}>
          {selectedOption?.label || placeholder}
        </span>
        <ChevronDown 
          className={`
            w-4 h-4 text-text-tertiary transition-transform duration-fast
            ${isOpen ? 'rotate-180' : ''}
          `} 
        />
      </button>
      
      {/* 下拉菜单 */}
      {isOpen && (
        <div 
          className="
            absolute z-50 w-full mt-1 
            bg-bg-elevated border border-border rounded-lg
            shadow-lg shadow-black/20
            max-h-60 overflow-auto custom-scrollbar
            animate-in
          "
        >
          {options.map((option, index) => (
            <button
              key={option.value}
              type="button"
              onClick={() => handleSelect(option.value)}
              disabled={option.disabled}
              className={`
                w-full flex items-center justify-between px-3 py-2.5
                text-left text-sm transition-colors duration-fast
                ${option.disabled 
                  ? 'opacity-40 cursor-not-allowed' 
                  : 'cursor-pointer hover:bg-bg-surface'
                }
                ${value === option.value 
                  ? 'bg-primary-500/10 text-primary-400' 
                  : 'text-text-secondary'
                }
                ${index === 0 ? 'rounded-t-lg' : ''}
                ${index === options.length - 1 ? 'rounded-b-lg' : ''}
              `}
            >
              <span className="truncate">{option.label}</span>
              {value === option.value && (
                <Check className="w-4 h-4 text-primary-500 shrink-0 ml-2" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default CustomSelect
