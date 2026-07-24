import React from 'react';
import { 
  Box, 
  Typography, 
  // Grid 
} from '@mui/material';
import TestimonialCard from '../TestimonialCard/TestimonialCard';
import Carousel from 'react-multi-carousel';
import 'react-multi-carousel/lib/styles.css';

const testimonials = [
  { name: 'Jessica M.', role: 'Mixologist', quote: 'Tipsyverse is my go-to for creative drink ideas!', image: '/assets/testimonials/jessica.jpg' },
  { name: 'Marcus T.', role: 'Home Bartender', quote: 'Easy to use and so inspiring.', image: '/assets/testimonials/marcus.jpg' },
  { name: 'Amara B.', role: 'Cocktail Blogger', quote: 'I love how beautiful and smooth the app is.', image: '/assets/testimonials/amara.jpg' },
  // Add more testimonials as needed
];

const responsive = {
  desktop: { breakpoint: { max: 3000, min: 1024 }, items: 2 },
  tablet: { breakpoint: { max: 1024, min: 640 }, items: 1 },
  mobile: { breakpoint: { max: 640, min: 0 }, items: 1 },
};

const TestimonialsCarousel = () => (
  <Box sx={{ py: 6, bgcolor: '#f5f5f5', textAlign: 'center' }}>
    <Typography variant="h4" gutterBottom>What People Are Saying</Typography>
    <Carousel responsive={responsive} autoPlay infinite arrows>
      {testimonials.map((t, i) => (
        <TestimonialCard key={i} {...t} />
      ))}
    </Carousel>
  </Box>
);

export default TestimonialsCarousel;
