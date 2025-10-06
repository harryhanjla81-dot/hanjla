
import React, { useRef, useEffect } from 'react';

interface CustomColorPickerProps {
  value: string;
  onChange: (color: string) => void;
  isOpen: boolean;
  onToggle: () => void;
  className?: string;
  label?: string;
}

const CustomColorPicker: React.FC<CustomColorPickerProps> = ({ value, onChange, isOpen, onToggle, className, label }) => {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const colorInputRef = useRef<HTMLInputElement>(null);

  const handleClickOutside = (event: MouseEvent) => {
    if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
      if (isOpen) {
        onToggle(); // Close it
      }
    }
  };

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    } else {
      document.removeEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onToggle]);

  // When the popover is opened, programmatically click the hidden color input
  // to trigger the browser's native color selection dialog immediately.
  useEffect(() => {
    if (isOpen) {
      colorInputRef.current?.click();
    }
  }, [isOpen]);

  return (
    <div className={`relative ${className || ''}`} ref={wrapperRef}>
      {/* Swatch button to toggle the popover */}
      <button
        type="button"
        className="w-full h-8 p-1 border rounded-md dark:border-gray-600 focus:outline-none focus:ring-2 focus:ring-primary"
        style={{ backgroundColor: value }}
        onClick={onToggle}
        aria-label={`${label || 'Color picker'}, current color ${value}`}
      />

      {/* Hidden native color input, which we trigger programmatically */}
      <input
        ref={colorInputRef}
        type="color"
        value={value}
        onInput={(e) => onChange((e.target as HTMLInputElement).value)}
        className="w-0 h-0 absolute top-0 left-0 opacity-0"
        tabIndex={-1} // Make it non-focusable
      />
      
      {/* Popover for Hex input */}
      {isOpen && (
        <div 
          className="absolute z-50 top-full mt-2 p-3 bg-white/90 dark:bg-gray-800/90 backdrop-blur-md rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700"
          onMouseDown={e => e.stopPropagation()}
        >
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 text-center">Hex Code</label>
          <input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="w-full p-1 text-center border rounded-md bg-gray-50 dark:bg-gray-700 dark:border-gray-500 font-mono text-sm"
          />
        </div>
      )}
    </div>
  );
};

export default CustomColorPicker;