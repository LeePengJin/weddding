import React, { createContext, useContext } from 'react';
import PropTypes from 'prop-types';

const VenueDesignerContext = createContext(null);

export const VenueDesignerProvider = ({ value, children }) => {
  return <VenueDesignerContext.Provider value={value}>{children}</VenueDesignerContext.Provider>;
};

VenueDesignerProvider.propTypes = {
  value: PropTypes.object,
  children: PropTypes.node,
};

export const useVenueDesigner = () => {
  const context = useContext(VenueDesignerContext);
  if (!context) {
    throw new Error('useVenueDesigner must be used within a VenueDesignerProvider');
  }
  return context;
};

export default VenueDesignerContext;


