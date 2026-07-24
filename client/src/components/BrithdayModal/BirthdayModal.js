import React, { useEffect, useState, useRef } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Typography,
  Button,
  Box,
  IconButton,
  Tooltip,
} from "@mui/material";
import CelebrationIcon from "@mui/icons-material/Celebration";
import MusicNoteIcon from "@mui/icons-material/MusicNote";
import MusicOffIcon from "@mui/icons-material/MusicOff";
import confetti from "canvas-confetti";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc"; // 👈 import plugin
import { useDispatch } from "react-redux";
import { setBlockingModal } from "../../features/ui/uiSlice";
dayjs.extend(utc); // 👈 enable the plugin

const BirthdayModal = ({ user, onDismiss }) => {
  const [open, setOpen] = useState(false);
  const [isPlaying, setIsPlaying] = useState(true);
  const audioRef = useRef(null);
  const dispatch = useDispatch();

  useEffect(() => {
    setOpen(true);
    dispatch(setBlockingModal("birthday"));
    // let parent set LS or do any side-effects if it wants
    return () => dispatch(setBlockingModal(null)); // safety on unmount
  }, [dispatch]);

  useEffect(() => {
    if (open) {
      confetti({
        particleCount: 120,
        spread: 100,
        origin: { y: 0.5 },
      });

      audioRef.current = new Audio("/sounds/happy-birthday.mp3");
      audioRef.current.loop = true;
      audioRef.current.play().catch((err) => {
        console.warn("Autoplay blocked:", err);
      });
    }

    return () => {
      audioRef.current?.pause();
      audioRef.current = null;
    };
  }, [open]);

  const toggleAudio = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play().catch(() => {});
    }
    setIsPlaying(!isPlaying);
  };

  if (!open) return null;

  return (
    <Dialog open={open} aria-labelledby="birthday-title">
      <Box
        sx={{ p: 3, textAlign: "center", maxWidth: 400, position: "relative" }}
      >
        <DialogTitle
          id="birthday-title"
          sx={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 1,
          }}
        >
          <CelebrationIcon
            sx={{ fontSize: 40, color: "#f50057" }}
            aria-hidden
          />
          <Typography component="span" variant="h5">
            Happy Birthday, {user?.fullName?.split(" ")[0] || "friend"}!
          </Typography>
        </DialogTitle>

        <Tooltip title={isPlaying ? "Turn off music" : "Play music"}>
          <IconButton
            onClick={toggleAudio}
            sx={{ position: "absolute", top: 10, right: 10 }}
          >
            {isPlaying ? <MusicOffIcon /> : <MusicNoteIcon />}
          </IconButton>
        </Tooltip>

        <DialogContent>
          <Typography variant="body1" sx={{ mt: 1 }}>
            🎉 Wishing you a day full of joy and a glass full of your favorite
            cocktail. You deserve it!
          </Typography>
        </DialogContent>
        <DialogActions sx={{ justifyContent: "center", mt: 2 }}>
          <Button
            variant="contained"
            sx={{ backgroundColor: "var(--primary-color)" }}
            onClick={() => {
              setOpen(false);
              audioRef.current?.pause();
              dispatch(setBlockingModal(null));
              if (typeof onDismiss === "function") onDismiss(); // set LS to true now
            }}
          >
            Thanks! 🥂
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
};

export default BirthdayModal;
