import React from 'react';
import {
  Box,
  Typography,
  Paper,
  Stack,
} from '@mui/material';
import EventAvailableOutlinedIcon from '@mui/icons-material/EventAvailableOutlined';
import SchoolOutlinedIcon from '@mui/icons-material/SchoolOutlined';
import LocalBarOutlinedIcon from '@mui/icons-material/LocalBarOutlined';


const features = [
  {
    icon: <EventAvailableOutlinedIcon fontSize="large" sx={{ color: 'var(--primary-color)' }} />,
    title: 'Event Service Built Around You',
    description: 'We plan staffing, timing, and bar service around your venue, guest count, and celebration.',
  },
  {
    icon: <SchoolOutlinedIcon fontSize="large" sx={{ color: 'var(--primary-color)' }} />,
    title: 'Prepared, Responsible Bartenders',
    description: 'Our learning and compliance workflows help bartenders arrive informed, qualified, and ready to serve responsibly.',
  },
  {
    icon: <LocalBarOutlinedIcon fontSize="large" sx={{ color: 'var(--primary-color)' }} />,
    title: 'Cocktail Knowledge Included',
    description: 'Explore drink inspiration and use our cocktail knowledge to shape a bar experience your guests will remember.',
  }
];

const UniqueFeatures = () => {


  return (
    <Box sx={{ py: 10, px: 2, backgroundColor: '#fff' }}>
      <Box maxWidth="lg" mx="auto" textAlign="center">
        <Typography variant="h4" fontWeight="bold" gutterBottom>
          Why Choose Tipsyverse?
        </Typography>
        <Typography variant="subtitle1" sx={{ mb: 6 }}>
          One place to book event bartending, develop service-ready talent, and discover drinks for every occasion.
        </Typography>

        <Box
          sx={{
            display: 'flex',
            flexDirection: { xs: 'column', sm: 'row' },
            gap: 4,
            alignItems: 'stretch',
            justifyContent: 'center',
            flexWrap: 'wrap',
          }}
        >
          {features.map((feature, index) => (
            <Paper
              key={index}
              elevation={3}
              sx={{
                flex: '1 1 300px',
                width: { xs: '100%' },
                minWidth: 280,
                p: 4,
                textAlign: 'center',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.3s ease',
                '&:hover': {
                  transform: 'scale(1.03)',
                  boxShadow: 6,
                  cursor: 'pointer',
                },
              }}
            >
              <Stack spacing={2} alignItems="center">
                {feature.icon}
                <Typography variant="h6" fontWeight="bold">
                  {feature.title}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {feature.description}
                </Typography>
              </Stack>
            </Paper>
          ))}
        </Box>
      </Box>
    </Box>
  );
};

export default UniqueFeatures;
