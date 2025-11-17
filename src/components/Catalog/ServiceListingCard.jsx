import React from 'react';
import { Card, CardContent, IconButton, Box, Typography } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import './ServiceListingCard.css';

const formatImageUrl = (url) => {
  if (!url) return '/images/default-product.jpg';
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }
  if (url.startsWith('/uploads')) {
    return `http://localhost:4000${url}`;
  }
  return url;
};

const ServiceListingCard = ({ item, onAdd, onShowDetails }) => {
  if (!item) return null;

  const image = formatImageUrl(item.images?.[0]);
  const isUnavailable = item.availability && item.availability.available === false;
  const availabilityLabel = isUnavailable ? 'Unavailable' : 'Available';

  return (
    <Card
      elevation={0}
      className={`catalog-card ${isUnavailable ? 'catalog-card-unavailable' : ''}`}
    >
      <Box className="catalog-card-thumb">
        <img src={image} alt={item.name} />
        <div className="catalog-card-overlay">
          <IconButton
            className="catalog-fab add"
            onClick={() => onAdd?.(item)}
            disabled={isUnavailable}
            size="small"
          >
            <AddIcon fontSize="inherit" />
          </IconButton>
          <IconButton className="catalog-fab info" onClick={() => onShowDetails?.(item)} size="small">
            <InfoOutlinedIcon fontSize="inherit" />
          </IconButton>
        </div>
      </Box>
      <CardContent className="catalog-card-body">
        <button type="button" className="catalog-card-name" onClick={() => onShowDetails?.(item)}>
          {item.name}
        </button>
        <Typography variant="caption" component="p" className="catalog-card-vendor">
          {item.vendor?.name || 'Vendor'}
        </Typography>
        <Typography variant="subtitle2" component="p" className="catalog-card-price">
          RM {Number(item.price).toLocaleString()}
        </Typography>
        <span className={`availability-pill ${isUnavailable ? 'unavailable' : 'available'}`}>
          {availabilityLabel}
        </span>
      </CardContent>
    </Card>
  );
};

export default ServiceListingCard;


