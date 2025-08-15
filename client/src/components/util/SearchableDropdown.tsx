import React, { useState, useMemo, useRef, useEffect } from 'react';

type Option = {
  image?: string;
  value: string;
  label: string;
};

type SearchableDropdownProps = {
  options: Option[];
  placeholder?: string;
  onChange?: (value: string | string[]) => void;
  value?: string | string[] | null;
  disabled?: boolean;
  className?: string;
  fluid?: boolean;
  style?: React.CSSProperties;
  multiple?: boolean;
};

const SearchableDropdown: React.FC<SearchableDropdownProps> = ({
  options,
  placeholder = "Search...",
  onChange,
  value = null,
  disabled = false,
  className = "",
  fluid = false,
  style,
  multiple = false,
}) => {
  const [search, setSearch] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [selected, setSelected] = useState<Option | null>(null);
  const [selectedMulti, setSelectedMulti] = useState<Option[]>([]);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (multiple) {
      const valueAsArray = Array.isArray(value) ? value : [];
      setSelectedMulti(options.filter((opt) => valueAsArray.includes(opt.value)));
      setSelected(null); // Ensure single-select state is cleared
    } else {
      if (value && typeof value === 'string') {
        const option = options.find(opt => opt.value === value);
        if (option) {
          setSelected(option);
          setSearch(option.label);
        }
      } else {
        setSelected(null);
        setSearch('');
      }
      setSelectedMulti([]); // Ensure multi-select state is cleared
    }
  }, [value, options, multiple]);

  const filteredOptions = useMemo(() => {
    let baseOptions = options.filter((option) =>
      option.label.toLowerCase().includes(search.toLowerCase())
    );

    // If multiple, filter out already selected options
    if (multiple) {
      const selectedValues = selectedMulti.map((opt) => opt.value);
      baseOptions = baseOptions.filter((opt) => !selectedValues.includes(opt.value));
    }
    return baseOptions;
  }, [options, search, multiple, selectedMulti]);

  const handleSelect = (option: Option) => {
    if (multiple) {
      const newSelection = [...selectedMulti, option];
      setSelectedMulti(newSelection);
      setSearch(''); // Clear search input after selection
      setIsOpen(false);
      if (onChange) {
        onChange(newSelection.map((opt) => opt.value));
      }
    } else {
      setSelected(option);
      setSearch(option.label);
      setIsOpen(false);
      if (onChange) {
        onChange(option.value);
      }
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value);
    setIsOpen(true);
  };

  const handleClear = () => {
    setSearch('');
    setSelected(null);
    setIsOpen(false);
    if (onChange) {
      onChange('');
    }
  };

  const handleRemove = (valueToRemove: string) => {
    if (disabled) return;
    const newSelection = selectedMulti.filter((opt) => opt.value !== valueToRemove);
    setSelectedMulti(newSelection);
    if (onChange) {
      onChange(newSelection.map((opt) => opt.value));
    }
  };

  return (
    <div className={`ui search dropdown ${fluid ? 'fluid' : ''} ${className} ${isOpen ? 'active visible' : ''} ${disabled ? 'disabled' : ''}`} 
        ref={dropdownRef}
        style={{ minWidth: '200px', ...style }}
    >
      <div className="relative">
        <input
          type="text"
          value={search}
          onChange={handleInputChange}
          onFocus={() => setIsOpen(true)}
          placeholder={multiple && selectedMulti.length > 0 ? 'Add more...' : placeholder}
          disabled={disabled}
          className={`
            w-full px-3 py-2 pr-10
            border border-gray-300 rounded-md
            focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
            disabled:bg-gray-100 disabled:cursor-not-allowed
            transition-all duration-200
          `}
        />
        
        {search && !disabled && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
        
        {!search && (
          <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none">
            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        )}
      </div>
      
      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto">
            {filteredOptions.length > 0 ? (
                filteredOptions.map((option) => (
                    <div
                    key={option.value}
                    onClick={() => handleSelect(option)}
                    className={`
                        px-3 py-2 cursor-pointer flex items-center
                        hover:bg-gray-100
                        ${!multiple && selected?.value === option.value ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-900'}
                        transition-colors duration-150
                    `}
                    >
                    {option.image && (
                        <img
                        src={option.image}
                        alt={option.label}
                        className="w-7 h-7 rounded-full mr-2 object-cover"
                        />
                    )}
                    {option.label}
                    </div>
                ))
            ) : (
            <div className="px-3 py-2 text-gray-500 text-center">
                No results found
            </div>
            )}
        </div>
      )}
    </div>
  );
};

export default SearchableDropdown;