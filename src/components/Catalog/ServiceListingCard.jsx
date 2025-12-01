import React from 'react';
import { Card, CardContent, IconButton, Box, Typography, Rating } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import StarIcon from '@mui/icons-material/Star';
import { formatImageUrl } from '../../utils/image';
import './ServiceListingCard.css';

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
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
          <Typography variant="subtitle2" component="p" className="catalog-card-price">
            RM {Number(item.price).toLocaleString()}
          </Typography>
          {item.averageRating && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <StarIcon sx={{ fontSize: '0.875rem', color: '#ffc107' }} />
              <Typography variant="caption" sx={{ fontSize: '0.75rem', fontWeight: 600 }}>
                {parseFloat(item.averageRating).toFixed(1)}
              </Typography>
              {item.reviewCount > 0 && (
                <Typography variant="caption" sx={{ fontSize: '0.7rem', color: '#8d8894' }}>
                  ({item.reviewCount})
                </Typography>
              )}
            </Box>
          )}
        </Box>
        <span className={`availability-pill ${isUnavailable ? 'unavailable' : 'available'}`}>
          {availabilityLabel}
        </span>
      </CardContent>
    </Card>
  );
};

export default ServiceListingCard;


