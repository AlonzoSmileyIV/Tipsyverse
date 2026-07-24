import { Box, FormControlLabel, Switch, Typography } from '@mui/material'
import React from 'react'

const NotificationForm = ({user}) => {
  return (
    <Box>
        <Typography variant="h6">Notifications</Typography>
            <Typography variant="body2" color="text.secondary">
              Choose which notifications you'd like to receive.
            </Typography>
            <FormControlLabel
              control={<Switch defaultChecked />}
              label="Likes & Comments"
            />
            <FormControlLabel control={<Switch />} label="Mentions" />
            <FormControlLabel control={<Switch />} label="Weekly Digest" />
    </Box>
  )
}

export default NotificationForm