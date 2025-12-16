import React from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Typography, Box, List, ListItem, ListItemIcon, ListItemText } from '@mui/material';
import { 
  Info as InfoIcon, 
  Mouse as MouseIcon, 
  Keyboard as KeyboardIcon, 
  OpenWith as MoveIcon, 
  RotateRight as RotateIcon, 
  Lock as LockIcon,
  ContentCopy as DuplicateIcon,
  Delete as DeleteIcon,
  LocalOffer as TagIcon,
  SatelliteAlt as OrbitIcon,
  DirectionsWalk as WalkIcon,
  Map as MapIcon,
  Layers as StackIcon,
  FamilyRestroom as ParentChildIcon,
  Highlight as HighlighterIcon
} from '@mui/icons-material';
import './HelpModal.css';

const HelpModal = ({ open, onClose }) => {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Box display="flex" alignItems="center" gap={1}>
          <InfoIcon color="primary" />
          <Typography variant="h6">3D Venue Design Guide</Typography>
        </Box>
      </DialogTitle>
      <DialogContent dividers>
        <Box sx={{ mb: 3 }}>
          <Typography variant="h6" gutterBottom>
            Basic Controls
          </Typography>
          <List>
            <ListItem>
              <ListItemIcon><MouseIcon /></ListItemIcon>
              <ListItemText 
                primary="Select Element"
                secondary="Click on any element to select it. Selected elements are highlighted with a pink circle."
              />
            </ListItem>
            <ListItem>
              <ListItemIcon><KeyboardIcon /></ListItemIcon>
              <ListItemText 
                primary="Multi-Select"
                secondary="Hold Shift and click to select multiple elements. Click empty space to deselect all."
              />
            </ListItem>
            <ListItem>
              <ListItemIcon><MoveIcon /></ListItemIcon>
              <ListItemText 
                primary="Move Elements"
                secondary="Select an element and drag it to move. When multiple elements are selected, drag any one to move them all together."
              />
            </ListItem>
            <ListItem>
              <ListItemIcon><RotateIcon /></ListItemIcon>
              <ListItemText 
                primary="Rotate Elements"
                secondary="Select an element, click 'Rotate' in the tooltip, then drag horizontally to rotate. Works for multiple selections too."
              />
            </ListItem>
          </List>
        </Box>

        <Box sx={{ mb: 3 }}>
          <Typography variant="h6" gutterBottom>
            Element Actions (Single Selection)
          </Typography>
          <List>
            <ListItem>
              <ListItemIcon><DuplicateIcon /></ListItemIcon>
              <ListItemText 
                primary="Duplicate"
                secondary="Create a copy of the element. For bundle services (e.g., table set), duplicates the entire bundle."
              />
            </ListItem>
            <ListItem>
              <ListItemIcon><DeleteIcon /></ListItemIcon>
              <ListItemText 
                primary="Delete"
                secondary="Remove the element from the design. Cannot delete elements that are part of a booking."
              />
            </ListItem>
            <ListItem>
              <ListItemIcon><LockIcon /></ListItemIcon>
              <ListItemText 
                primary="Lock/Unlock"
                secondary="Lock elements to prevent accidental movement. Locked elements cannot be moved or rotated."
              />
            </ListItem>
            <ListItem>
              <ListItemIcon><TagIcon /></ListItemIcon>
              <ListItemText 
                primary="Tag Services (Tables only)"
                secondary="Assign services to tables for per-table pricing (e.g., centerpieces, table settings)."
              />
            </ListItem>
          </List>
        </Box>

        <Box sx={{ mb: 3 }}>
          <Typography variant="h6" gutterBottom>
            Group Operations (Multi-Selection)
          </Typography>
          <List>
            <ListItem>
              <ListItemIcon><MoveIcon /></ListItemIcon>
              <ListItemText 
                primary="Move Together"
                secondary="Select multiple elements (Shift+Click), then drag any selected element to move them all as a group."
              />
            </ListItem>
            <ListItem>
              <ListItemIcon><RotateIcon /></ListItemIcon>
              <ListItemText 
                primary="Rotate Together"
                secondary="Select multiple elements, click 'Rotate' in the group toolbar, then drag to rotate all selected elements in place."
              />
            </ListItem>
            <ListItem>
              <ListItemIcon><LockIcon /></ListItemIcon>
              <ListItemText 
                primary="Lock/Unlock Group"
                secondary="Lock or unlock all selected elements at once using the group toolbar."
              />
            </ListItem>
          </List>
        </Box>

        <Box sx={{ mb: 3 }}>
          <Typography variant="h6" gutterBottom>
            Parent-Child Relationships
          </Typography>
          <List>
            <ListItem>
              <ListItemIcon><StackIcon /></ListItemIcon>
              <ListItemText 
                primary="Stacking Elements"
                secondary="Place stackable elements (e.g., bouquets, centerpieces) on top of other elements (e.g., tables). The system automatically creates a parent-child relationship."
              />
            </ListItem>
            <ListItem>
              <ListItemIcon><MoveIcon /></ListItemIcon>
              <ListItemText 
                primary="Moving Parent Elements"
                secondary="When you move a parent element (e.g., a table), all child elements (e.g., bouquets on the table) automatically move with it, maintaining their relative positions."
              />
            </ListItem>
            <ListItem>
              <ListItemIcon><RotateIcon /></ListItemIcon>
              <ListItemText 
                primary="Rotating Parent Elements"
                secondary="When you rotate a parent element, child elements rotate around the parent's center, maintaining their relative positions (e.g., a bouquet at 12 o'clock moves to 3 o'clock when table rotates 90°)."
              />
            </ListItem>
          </List>
        </Box>

        <Box sx={{ mb: 3 }}>
          <Typography variant="h6" gutterBottom>
            Booking Status Highlight
          </Typography>
          <List>
            <ListItem>
              <ListItemIcon><HighlighterIcon /></ListItemIcon>
              <ListItemText
                primary="Highlight booked elements"
                secondary="Use the 'Booking status' highlight button (highlighter icon) to color the outline of elements based on the booking status for that service."
              />
            </ListItem>
            <ListItem sx={{ pl: 7 }}>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                {[
                  { label: 'Pending confirmation', color: '#fbbf24' },
                  { label: 'Pending deposit', color: '#fb923c' },
                  { label: 'Confirmed', color: '#34d399' },
                  { label: 'Pending final payment', color: '#60a5fa' },
                  { label: 'Completed', color: '#a3a3a3' },
                  { label: 'Not booked', color: '#94a3b8' },
                ].map((row) => (
                  <Box key={row.label} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Box
                      sx={{
                        width: 12,
                        height: 12,
                        borderRadius: '999px',
                        backgroundColor: row.color,
                        boxShadow: '0 0 0 2px rgba(0,0,0,0.08)',
                        flex: '0 0 auto',
                      }}
                    />
                    <Typography variant="body2" color="text.secondary">
                      {row.label}
                    </Typography>
                  </Box>
                ))}
              </Box>
            </ListItem>
            <ListItem>
              <ListItemIcon><MouseIcon /></ListItemIcon>
              <ListItemText
                primary="See which service an element belongs to"
                secondary="When booking highlight is ON, hover an element to see its service name and current booking status."
              />
            </ListItem>
          </List>
        </Box>

        <Box>
          <Typography variant="h6" gutterBottom>
            View Modes
          </Typography>
          <List>
            <ListItem>
              <ListItemIcon>
                <i className="fas fa-satellite-dish" style={{ fontSize: '24px', color: 'rgba(0, 0, 0, 0.54)' }}></i>
              </ListItemIcon>
              <ListItemText 
                primary="Orbit View"
                secondary="Default view mode. Click and drag to orbit around the scene. Scroll to zoom."
              />
            </ListItem>
            <ListItem>
              <ListItemIcon>
                <i className="fas fa-walking" style={{ fontSize: '24px', color: 'rgba(0, 0, 0, 0.54)' }}></i>
              </ListItemIcon>
              <ListItemText 
                primary="Walk View"
                secondary="First-person view. Click to look around, use WASD keys to move. Press Esc to exit."
              />
            </ListItem>
            <ListItem>
              <ListItemIcon>
                <i className="fas fa-map" style={{ fontSize: '24px', color: 'rgba(0, 0, 0, 0.54)' }}></i>
              </ListItemIcon>
              <ListItemText 
                primary="Top View"
                secondary="View from above for precise 2D positioning of elements."
              />
            </ListItem>
          </List>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} variant="contained">Got it</Button>
      </DialogActions>
    </Dialog>
  );
};

export default HelpModal;

