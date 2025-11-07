import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  Stack,
  Chip,
  List,
  ListItem,
  ListItemText,
  Divider,
  Button,
} from '@mui/material';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import PeopleAltIcon from '@mui/icons-material/PeopleAlt';
import StorefrontIcon from '@mui/icons-material/Storefront';
import LocalOfferIcon from '@mui/icons-material/LocalOffer';
import AssignmentIcon from '@mui/icons-material/Assignment';
import { apiFetch } from '../../lib/api';

export default function Dashboard() {
  const navigate = useNavigate();
  const [pendingVendors, setPendingVendors] = useState([]);
  const [activeVendors, setActiveVendors] = useState([]);
  const [recentActivities, setRecentActivities] = useState([]);

  useEffect(() => {
    document.title = 'Weddding Admin — Dashboard';
  }, []);

  useEffect(() => {
    apiFetch('/admin/auth/me').catch(() => navigate('/admin/login'));
  }, [navigate]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [pending, active] = await Promise.all([
          apiFetch('/admin/vendors?status=pending_verification'),
          apiFetch('/admin/vendors?status=active'),
        ]);
        setPendingVendors(pending || []);
        setActiveVendors(active || []);

        const combinedActivities = [
          ...(pending || []).slice(0, 3).map((v) => ({
            title: 'New vendor registration',
            subtitle: v.name || v.email,
            timestamp: v.createdAt,
          })),
          ...(active || []).slice(0, 2).map((v) => ({
            title: 'Vendor approved',
            subtitle: v.name || v.email,
            timestamp: v.updatedAt,
          })),
        ].sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0));
        setRecentActivities(combinedActivities.slice(0, 5));
      } catch (err) {
        console.error('Dashboard data fetch failed', err);
      }
    };

    fetchData();
  }, []);

  const summaryCards = useMemo(() => [
    {
      title: 'Pending Vendors',
      value: pendingVendors.length,
      icon: <AssignmentIcon fontSize="large" />,
      color: '#d9daef',
    },
    {
      title: 'Active Users',
      value: '--',
      icon: <PeopleAltIcon fontSize="large" />,
      color: '#fde7d9',
    },
    {
      title: 'Active Vendors',
      value: activeVendors.length,
      icon: <StorefrontIcon fontSize="large" />,
      color: '#e2f4ec',
    },
    {
      title: 'Popular Packages',
      value: 'Basic Wedding Package',
      icon: <LocalOfferIcon fontSize="large" />,
      color: '#ffe3ed',
    },
  ], [pendingVendors.length, activeVendors.length]);

  const topVendors = useMemo(() => {
    return [...activeVendors]
      .sort((a, b) => (b.vendor?.rating || 0) - (a.vendor?.rating || 0))
      .slice(0, 4)
      .map((v) => ({
        name: v.name || v.email,
        reviews: v.vendor?.reviewsCount || 0,
        rating: v.vendor?.rating || 0,
      }));
  }, [activeVendors]);

  return (
    <Box>
      <Typography variant="h5" sx={{ fontWeight: 700, mb: 3 }}>Dashboard</Typography>

      <Grid container spacing={2} sx={{ mb: 3 }}>
        {summaryCards.map((card) => (
          <Grid item xs={12} sm={6} md={3} key={card.title}>
            <Card sx={{ borderRadius: 2, boxShadow: '0 6px 16px rgba(15, 6, 13, 0.08)' }}>
              <CardContent>
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Box>
                    <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>{card.title}</Typography>
                    <Typography variant="h5" sx={{ fontWeight: 700 }}>{card.value}</Typography>
                  </Box>
                  <Box sx={{ backgroundColor: card.color, borderRadius: '50%', p: 1.5 }}>
                    {card.icon}
                  </Box>
                </Stack>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Grid container spacing={2}>
        <Grid item xs={12} md={6}>
          <Card sx={{ borderRadius: 2, mb: 2 }}>
            <CardContent>
              <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>Recent Activities</Typography>
              {recentActivities.length === 0 ? (
                <Typography variant="body2" color="text.secondary">No recent activity.</Typography>
              ) : (
                <List>
                  {recentActivities.map((activity, idx) => (
                    <React.Fragment key={idx}>
                      <ListItem alignItems="flex-start">
                        <ListItemText
                          primary={<Typography sx={{ fontWeight: 600 }}>{activity.title}</Typography>}
                          secondary={
                            <>
                              <Typography variant="body2" color="text.secondary">{activity.subtitle}</Typography>
                              <Typography variant="caption" color="text.secondary">
                                {activity.timestamp ? new Date(activity.timestamp).toLocaleString() : '—'}
                              </Typography>
                            </>
                          }
                        />
                      </ListItem>
                      {idx < recentActivities.length - 1 && <Divider component="li" />}
                    </React.Fragment>
                  ))}
                </List>
              )}
            </CardContent>
          </Card>

          <Card sx={{ borderRadius: 2 }}>
            <CardContent>
              <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>Quick Actions</Typography>
              <Stack spacing={2}>
                <Button variant="outlined" startIcon={<AssignmentIcon />} component={Link} to="/admin/vendors">Review Pending Vendors</Button>
                <Button variant="outlined" startIcon={<LocalOfferIcon />}>Create New Package</Button>
                <Button variant="outlined" startIcon={<TrendingUpIcon />}>Generate Report</Button>
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6}>
          <Card sx={{ borderRadius: 2, mb: 2 }}>
            <CardContent>
              <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>Top Performing Vendors</Typography>
              {topVendors.length === 0 ? (
                <Typography variant="body2" color="text.secondary">No vendor performance data available.</Typography>
              ) : (
                <List>
                  {topVendors.map((vendor, idx) => (
                    <React.Fragment key={vendor.name + idx}>
                      <ListItem secondaryAction={<Chip label={`${vendor.rating.toFixed(1)}`} color="success" />}>
                        <ListItemText
                          primary={<Typography sx={{ fontWeight: 600 }}>{vendor.name}</Typography>}
                          secondary={`${vendor.reviews} reviews`}
                        />
                      </ListItem>
                      {idx < topVendors.length - 1 && <Divider component="li" />}
                    </React.Fragment>
                  ))}
                </List>
              )}
            </CardContent>
          </Card>

          <Card sx={{ borderRadius: 2 }}>
            <CardContent>
              <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>Summary</Typography>
              <Typography variant="body2" color="text.secondary">
                Monitor vendor onboarding, track engagement, and manage packages directly from this dashboard. Use quick actions to stay on top of time-sensitive tasks.
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}


