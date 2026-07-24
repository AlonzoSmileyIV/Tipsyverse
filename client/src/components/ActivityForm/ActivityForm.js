import React, { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Box,
  Typography,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Avatar,
  Menu,
  MenuItem,
  TextField,
  Button,
} from "@mui/material";
import { Delete, MoreVert, Visibility } from "@mui/icons-material";
import { handleUpdateUser } from "../../utils/handleUpdateUser";
import api from "../../services/api";
import { useDispatch } from "react-redux";
import { navigateOrReload } from "../../utils/navigateOrReload";
import { CollapseAlert } from "../CollapseAlert/CollapseAlert";

const ActivityForm = ({ user }) => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [searchLiked, setSearchLiked] = useState("");
  const [searchSaved, setSearchSaved] = useState("");
  const [anchorLikedMenu, setAnchorLikedMenu] = useState(null);
  const [anchorSavedMenu, setAnchorSavedMenu] = useState(null);
  const [alert, setAlert] = useState({
    open: false,
    message: "",
    severity: "success",
  });

  const location = useLocation();

  const likedRef = useRef(null);
  const savedRef = useRef(null);

  useEffect(() => {
    if (alert.open) {
      const timer = setTimeout(() => {
        setAlert({ ...alert, open: false });
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [alert]);

  useEffect(() => {
    if (!location.hash) return;

    const hash = location.hash.replace("#", "");

    const scrollOptions = {
      behavior: "smooth",
      block: "start",
    };

    // small timeout so DOM fully renders
    const timer = setTimeout(() => {
      if (hash === "liked") {
        likedRef.current?.scrollIntoView(scrollOptions);
      }

      if (hash === "saved") {
        savedRef.current?.scrollIntoView(scrollOptions);
      }
    }, 100);

    return () => clearTimeout(timer);
  }, [location.hash]);

  const handleLikedMenuOpen = (event) =>
    setAnchorLikedMenu(event.currentTarget);
  const handleSavedMenuOpen = (event) =>
    setAnchorSavedMenu(event.currentTarget);
  const handleMenuClose = () => {
    setAnchorLikedMenu(null);
    setAnchorSavedMenu(null);
  };

  const likedDrinks = (user?.likedDrinks || [])
    .filter((drink) =>
      drink.name.toLowerCase().includes(searchLiked.toLowerCase())
    )
    .sort((a, b) => new Date(b.dateLiked) - new Date(a.dateLiked)); // Most recent first

  const savedDrinks = (user?.savedDrinks || [])
    .filter((drink) =>
      drink.name.toLowerCase().includes(searchSaved.toLowerCase())
    )
    .sort((a, b) => new Date(b.dateSaved) - new Date(a.dateSaved));

  const handleRemoveLikedDrink = async (drinkId) => {
    try {
      await api.put(`/drinks/${drinkId}/toggle-like`);
      await handleUpdateUser(dispatch);
      setAlert({
        open: true,
        message: "Removed from liked drink.",
        severity: "success",
      });
    } catch (err) {
      setAlert({
        open: true,
        message: "Error removing liked drink.",
        severity: "error",
      });
    }
  };

  const handleRemoveSavedDrink = async (drinkId) => {
    try {
      await api.put(`/drinks/${drinkId}/toggle-bookmark`);
      await handleUpdateUser(dispatch);
      setAlert({
        open: true,
        message: "Removed from saved drink.",
        severity: "success",
      });
    } catch (err) {
      setAlert({
        open: true,
        message: "Error removing saved drink.",
        severity: "error",
      });
    }
  };

  return (
    <Box>
      <Typography variant="h6">Activity</Typography>
      <Typography variant="body2" color="text.secondary" mb={2}>
        View and manage your liked and saved drinks.
      </Typography>
      <CollapseAlert
        open={alert.open}
        severity={alert.severity}
        message={alert.message}
        onClose={() => setAlert({ ...alert, open: false })}
      />

      {/* === LIKED DRINKS === */}
      <Box
        mb={1}
        ref={likedRef}
        display="flex"
        alignItems="center"
        justifyContent="space-between"
        sx={{
          scrollMarginTop: "100px",
        }}
      >
        <Typography variant="subtitle2">Liked Drinks</Typography>
        <IconButton onClick={handleLikedMenuOpen}>
          <MoreVert fontSize="small" />
        </IconButton>
        <Menu
          anchorEl={anchorLikedMenu}
          open={Boolean(anchorLikedMenu)}
          onClose={handleMenuClose}
        >
          <MenuItem
            onClick={() => {
              handleMenuClose();
            }}
          >
            Remove all liked drinks
          </MenuItem>
        </Menu>
      </Box>
      <TextField
        label="Search liked drinks"
        size="small"
        fullWidth
        sx={{ mb: 1 }}
        value={searchLiked}
        onChange={(e) => setSearchLiked(e.target.value)}
      />
      {likedDrinks.length > 0 ? (
        <Box
          sx={{
            maxHeight: 300,
            overflowY: "auto",
            mb: 2,
            "&::-webkit-scrollbar": {
              width: "6px",
            },
            "&::-webkit-scrollbar-thumb": {
              backgroundColor: "rgba(0,0,0,0.2)",
              borderRadius: "3px",
            },
          }}
        >
          <List>
            {likedDrinks.map((drink) => (
              <ListItem
                key={drink?._id}
                component="li"
                onClick={() =>
                  navigateOrReload(navigate, `/drinks/${drink?.slug}`)
                }
                sx={{
                  cursor: "pointer",
                  "&:hover": {
                    backgroundColor: "rgba(0,0,0,0.04)", // light hover effect
                  },
                }}
              >
                <ListItemAvatar>
                  <Avatar src={drink?.photo} alt={drink?.name} />
                </ListItemAvatar>
                <ListItemText primary={drink?.name} />
                <ListItemSecondaryAction>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <Button
                      size="small"
                      variant="outlined"
                      startIcon={<Visibility />}
                      onClick={(e) => {
                        e.stopPropagation();
                        navigateOrReload(navigate, `/drinks/${drink?.slug}`);
                      }}
                      sx={{
                        textTransform: "none",
                        borderColor: "var(--primary-color)",
                        color: "var(--primary-color)",
                        display: { xs: "none", sm: "flex" },
                      }}
                    >
                      View
                    </Button>

                    <IconButton
                      edge="end"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemoveLikedDrink(drink._id);
                      }}
                      sx={{
                        textTransform: "none",
                        borderColor: "var(--primary-color)",
                        color: "var(--primary-color)"}}
                    >
                      <Delete />
                    </IconButton>
                  </Box>
                </ListItemSecondaryAction>
              </ListItem>
            ))}
          </List>
        </Box>
      ) : (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          No liked drinks.
        </Typography>
      )}

      {/* === saved DRINKS === */}
      <Box
        ref={savedRef}
        mt={3}
        mb={1}
        sx={{
          scrollMarginTop: "100px",
        }}
        display="flex"
        alignItems="center"
        justifyContent="space-between"
      >
        <Typography variant="subtitle2">Saved Drinks</Typography>
        <IconButton onClick={handleSavedMenuOpen}>
          <MoreVert fontSize="small" />
        </IconButton>
        <Menu
          anchorEl={anchorSavedMenu}
          open={Boolean(anchorSavedMenu)}
          onClose={handleMenuClose}
        >
          <MenuItem
            onClick={() => {
              handleMenuClose();
            }}
          >
            Remove all saved drinks
          </MenuItem>
        </Menu>
      </Box>
      <TextField
        label="Search saved drinks"
        size="small"
        fullWidth
        sx={{ mb: 1 }}
        value={searchSaved}
        onChange={(e) => setSearchSaved(e.target.value)}
      />
      {savedDrinks.length > 0 ? (
        <Box
          sx={{
            maxHeight: 300,
            overflowY: "auto",
            mb: 2,
            "&::-webkit-scrollbar": {
              width: "6px",
            },
            "&::-webkit-scrollbar-thumb": {
              backgroundColor: "rgba(0,0,0,0.2)",
              borderRadius: "3px",
            },
          }}
        >
          <List>
            {savedDrinks.map((drink) => (
              <ListItem
                key={drink._id}
                onClick={() =>
                  navigateOrReload(navigate, `/drinks/${drink.slug}`)
                }
                sx={{
                  cursor: "pointer",
                  "&:hover": {
                    backgroundColor: "rgba(0,0,0,0.04)", // light hover effect
                  },
                }}
              >
                <ListItemAvatar>
                  <Avatar src={drink.photo} alt={drink.name} />
                </ListItemAvatar>
                <ListItemText primary={drink.name} />
                <ListItemSecondaryAction>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <Button
                      size="small"
                      variant="outlined"
                      startIcon={<Visibility />}
                      onClick={(e) => {
                        e.stopPropagation();
                        navigateOrReload(navigate, `/drinks/${drink?.slug}`);
                      }}
                      sx={{
                        textTransform: "none",
                        borderColor: "var(--primary-color)",
                        color: "var(--primary-color)",
                        display: { xs: "none", sm: "flex" },
                      }}
                    >
                      View
                    </Button>

                    <IconButton
                      edge="end"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemoveSavedDrink(drink._id);
                      }}
                      sx={{
                        textTransform: "none",
                        borderColor: "var(--primary-color)",
                        color: "var(--primary-color)"}}
                    >
                      <Delete />
                    </IconButton>
                  </Box>
                </ListItemSecondaryAction>
              </ListItem>
            ))}
          </List>
        </Box>
      ) : (
        <Typography variant="body2" color="text.secondary">
          No saved drinks.
        </Typography>
      )}
    </Box>
  );
};

export default ActivityForm;
