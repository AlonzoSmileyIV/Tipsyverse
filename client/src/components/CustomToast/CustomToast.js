import { Avatar, AvatarGroup, Box, Typography } from "@mui/material";
import { useNavigate } from "react-router-dom";
import { navigateOrReload } from "../../utils/navigateOrReload";
import getNotificationPath from "../../utils/getNotificationPath";

const CustomToast = ({ actors = [], message, ...notification }) => {
    const navigate = useNavigate();

const handleClick = () => {
    const path = getNotificationPath({ ...notification, message });
    if (path) navigateOrReload(navigate, path);
  };



  return (
    <Box onClick={() => handleClick()} display="flex" alignItems="center" gap={1} sx={{ cursor: "pointer" }}>
      {actors.length > 1 ? (
        <AvatarGroup max={2} sx={{ '& .MuiAvatar-root': { width: 28, height: 28 } }}>
          {actors.slice(0, 2).map((actor, index) => (
            <Avatar key={index} src={actor?.profile?.photo} alt={actor.fullName} />
          ))}
        </AvatarGroup>
      ) : actors.length === 1 ? (
        <Avatar
          src={actors[0]?.profile?.photo}
          alt={actors[0].fullName}
          sx={{ width: 32, height: 32 }}
        />
      ) : null}
      <Typography variant="body2">{message}</Typography>
    </Box>
  );
};

export default CustomToast;
