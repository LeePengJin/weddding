import React from 'react';
import {
  Paper,
  IconButton,
  TextField,
  InputAdornment,
  FormControl,
  Select,
  MenuItem,
  Typography,
  Box,
  Button,
  Tooltip,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import LayersOutlinedIcon from '@mui/icons-material/LayersOutlined';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { Link as RouterLink } from 'react-router-dom';
import ServiceListingCard from './ServiceListingCard';
import CatalogDetailPanel from './CatalogDetailPanel';
import './CatalogSidebar.css';

const CatalogSidebar = ({
  collapsed,
  onToggle,
  backLabel = 'Back',
  backTo,
  onBack,
  searchTerm,
  onSearch,
  selectedCategory,
  onCategoryChange,
  categories,
  items,
  loading,
  onAdd,
  onShowDetails,
  selectedItem,
  onCloseDetails,
  onShowItem3D,
  onMessageVendor,
  sidebarFooter,
}) => {
  const backButtonProps = backTo
    ? {
        component: RouterLink,
        to: backTo,
      }
    : {};

  const handleBackClick = (event) => {
    if (onBack) {
      onBack(event);
    }
  };

  return (
    <Paper elevation={0} square className={`catalog-panel ${collapsed ? 'collapsed' : ''}`}>
      <div className="catalog-header-row">
        {!collapsed && (
          <div className="catalog-heading">
            <Button
              variant="text"
              startIcon={<ArrowBackIcon fontSize="small" />}
              className="catalog-back-button"
              onClick={handleBackClick}
              {...backButtonProps}
            >
              {backLabel}
            </Button>
            <Typography variant="h5" component="h3">
              Design catalog
            </Typography>
            <Typography variant="body2">Browse services and add them directly to your scene.</Typography>
          </div>
        )}
        <IconButton className="catalog-toggle" onClick={onToggle} aria-label="Toggle catalog">
          {collapsed ? <ChevronRightIcon fontSize="small" /> : <ChevronLeftIcon fontSize="small" />}
        </IconButton>
      </div>

      {collapsed ? (
        <div className="catalog-collapsed">
          <Tooltip title={backLabel}>
            <IconButton
              size="small"
              className="catalog-back-icon"
              onClick={handleBackClick}
              {...backButtonProps}
            >
              <ArrowBackIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <LayersOutlinedIcon fontSize="small" />
          <span>Catalog</span>
        </div>
      ) : selectedItem ? (
        <CatalogDetailPanel
          item={selectedItem}
          onBack={onCloseDetails}
          onAdd={onAdd}
          onMessageVendor={onMessageVendor}
          onShow3D={onShowItem3D}
        />
      ) : (
        <>
          <TextField
            size="small"
            placeholder="Search items..."
            value={searchTerm}
            onChange={(e) => onSearch?.(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" />
                </InputAdornment>
              ),
            }}
            className="catalog-search-field"
          />

          <FormControl size="small" fullWidth className="catalog-select-control">
            <Select value={selectedCategory} onChange={(e) => onCategoryChange?.(e.target.value)}>
              {categories.map((category) => (
                <MenuItem key={category} value={category}>
                  {category.replace('_', ' ')}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <Box className={`catalog-grid ${loading || items.length === 0 ? 'empty-state' : ''}`}>
            {loading && (
              <div className="catalog-empty">
                <i className="fas fa-spinner fa-spin"></i>
                <p>Loading catalog…</p>
              </div>
            )}

            {!loading && items.length === 0 && (
              <div className="catalog-empty">
                <i className="fas fa-search"></i>
                <p>No listings match the current filters</p>
              </div>
            )}

            {!loading &&
              items.map((item) => (
                <ServiceListingCard key={item.id} item={item} onAdd={onAdd} onShowDetails={onShowDetails} />
              ))}
          </Box>
        </>
      )}

      {!collapsed && sidebarFooter && <Box className="catalog-sidebar-footer">{sidebarFooter}</Box>}
    </Paper>
  );
};

export default CatalogSidebar;


