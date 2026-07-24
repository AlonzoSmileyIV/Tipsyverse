import React from 'react';
import { Card, 
  // CardContent, 
  Typography, 
  Avatar, 
  Box 
} from '@mui/material';

const TestimonialCard = ({ name, role, quote, image }) => (
  <Card sx={{ m: 2, p: 3, borderRadius: 4 }}>
    <Box display="flex" flexDirection="column" alignItems="center">
      <Avatar src={image} sx={{ width: 64, height: 64, mb: 2 }} />
      <Typography variant="body1" fontStyle="italic" gutterBottom>"{quote}"</Typography>
      <Typography variant="subtitle1" fontWeight="bold">{name}</Typography>
      <Typography variant="caption" color="textSecondary">{role}</Typography>
    </Box>
  </Card>
);

export default TestimonialCard;
