import React from 'react';

const GlassInputForm = ({ 
  value, 
  onChange, 
  onSubmit, 
  placeholder = '입력하세요...', 
  buttonText = '전송', 
  disabled = false, 
  isSubmitDisabled = false,
  className = ''
}) => {
  return (
    <form className={`glass-input-form ${className}`} onSubmit={onSubmit}>
      <input
        type="text"
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        disabled={disabled}
      />
      <button type="submit" disabled={disabled || isSubmitDisabled}>
        {buttonText}
      </button>
    </form>
  );
};

export default GlassInputForm;
