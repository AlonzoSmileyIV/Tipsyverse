import React from 'react';
import { 
  Box, 
  Typography, 
  // Grid 
} from '@mui/material';
import TestimonialCard from '../TestimonialCard/TestimonialCard';
import { Autoplay, Navigation } from "swiper/modules";
import { Swiper, SwiperSlide } from "swiper/react";
import "swiper/css";
import "swiper/css/navigation";

const testimonials = [
  { name: 'Jessica M.', role: 'Mixologist', quote: 'Tipsyverse is my go-to for creative drink ideas!', image: '/assets/testimonials/jessica.jpg' },
  { name: 'Marcus T.', role: 'Home Bartender', quote: 'Easy to use and so inspiring.', image: '/assets/testimonials/marcus.jpg' },
  { name: 'Amara B.', role: 'Cocktail Blogger', quote: 'I love how beautiful and smooth the app is.', image: '/assets/testimonials/amara.jpg' },
  // Add more testimonials as needed
];

const TestimonialsCarousel = () => (
  <Box sx={{ py: 6, bgcolor: '#f5f5f5', textAlign: 'center' }}>
    <Typography variant="h4" gutterBottom>What People Are Saying</Typography>
    <Swiper
      modules={[Autoplay, Navigation]}
      autoplay={{ delay: 5000 }}
      navigation
      loop
      spaceBetween={16}
      slidesPerView={1}
      breakpoints={{ 1024: { slidesPerView: 2 } }}
    >
      {testimonials.map((t, i) => (
        <SwiperSlide key={i}>
          <TestimonialCard {...t} />
        </SwiperSlide>
      ))}
    </Swiper>
  </Box>
);

export default TestimonialsCarousel;
