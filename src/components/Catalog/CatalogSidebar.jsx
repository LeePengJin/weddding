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
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import LayersOutlinedIcon from '@mui/icons-material/LayersOutlined';
import ServiceListingCard from './ServiceListingCard';
import './CatalogSidebar.css';

const CatalogSidebar = ({
  collapsed,
  onToggle,
  searchTerm,
  onSearch,
  selectedCategory,
  onCategoryChange,
  categories,
  items,
  loading,
  onAdd,
  onShowDetails,
}) => {
  return (
    <Paper elevation={0} square className={`catalog-panel ${collapsed ? 'collapsed' : ''}`}>
      <div className="catalog-header-row">
        {!collapsed && (
          <div className="catalog-heading">
            <Typography variant="overline" className="catalog-label">
              Add Items
            </Typography>
            <Typography variant="h5" component="h3">
              Design Catalog
            </Typography>
            <Typography variant="body2">Drag items to your venue space</Typography>
          </div>
        )}
        <IconButton className="catalog-toggle" onClick={onToggle} aria-label="Toggle catalog">
          {collapsed ? <ChevronRightIcon fontSize="small" /> : <ChevronLeftIcon fontSize="small" />}
        </IconButton>
      </div>

      {collapsed ? (
        <div className="catalog-collapsed">
          <LayersOutlinedIcon fontSize="small" />
          <span>Catalog</span>
        </div>
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

          <Box className="catalog-grid">
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
                <ServiceListingCard
                  key={item.id}
                  item={item}
                  onAdd={onAdd}
                  onShowDetails={onShowDetails}
                />
              ))}
          </Box>
        </>
      )}
    </Paper>
  );
};

export default CatalogSidebar;


