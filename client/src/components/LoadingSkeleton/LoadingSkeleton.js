import { Box, Skeleton } from '@mui/material'
import HelmetHeader from '../HelmetHeader/Helmet'

const LoadingSkeleton = () => {
  return (
    <Box sx={{ my: 4 }}>
          <HelmetHeader
          title={`Tipsyverse`}
        />
          <Skeleton variant="rounded" width="50%" height={200} />
          <Skeleton variant="text" height={40} width="40%" sx={{ mt: 2 }} />
          <Skeleton variant="text" height={30} width="40%" />
          <Skeleton variant="text" height={30} width="50%" sx={{ mt: 2 }} />
          <Skeleton variant="text" height={30} width="50%" />
          <Skeleton variant="text" height={300} width="60%" />
        </Box>
  )
}

export default LoadingSkeleton