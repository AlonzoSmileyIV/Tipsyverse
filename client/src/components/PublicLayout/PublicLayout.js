import React from 'react'
import Header from '../Header/Header'
import Footer from '../Footer/Footer'
import { Box } from '@mui/material';


const PublicLayout = ({children}) => {
  return (
    <Box
      display="flex"
      flexDirection="column"
      minHeight="100vh"
    >
      <Header />
      <Box component="main" flex="1">
        {children}
      </Box>
      <Footer />
    </Box>
  )
}

export default PublicLayout