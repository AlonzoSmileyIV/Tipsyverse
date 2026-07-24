import { Router } from "express";
import { drinkCtrl } from "../../controllers/index.js";
import { auth, authEmployee, optionalAuth, uploadExcel } from "../../middleware/index.js";
import { uploadImage, uploadVideo } from "../../utils/index.js";

const drinkRouter = Router();

drinkRouter.post('/bulk', uploadExcel.single('file'), auth, authEmployee, drinkCtrl.bulkDrinkBulker);

// -------- FILE UPLOAD --------
drinkRouter.post('/upload-image', uploadImage.single('photo'), auth, drinkCtrl.uploadDrinkImage);
drinkRouter.post('/upload-video', uploadVideo.single('video'), auth, drinkCtrl.uploadDrinkVideo);
// -------- CREATE --------
drinkRouter.post('/create', auth, drinkCtrl.createDrink);

// -------- READ --------
drinkRouter.get('/', drinkCtrl.viewAllDrinks);
drinkRouter.get('/top-trending', drinkCtrl.viewTopTrending); // ✅ Place BEFORE dynamic routes
drinkRouter.get('/by-category', drinkCtrl.viewDrinksByCategory);
drinkRouter.get('/recent', drinkCtrl.viewMostRecentDrinks);
drinkRouter.get('/recommended', auth, drinkCtrl.viewRecommendedDrinksForUser);
drinkRouter.get("/id/:id", drinkCtrl.viewDrink);
drinkRouter.get('/slug/:slug', drinkCtrl.viewDrinkbySlug);

// -------- UPDATE --------
drinkRouter.put('/:id', auth, authEmployee, drinkCtrl.updateDrink);
drinkRouter.post("/:slug/view", optionalAuth, drinkCtrl.incrementDrinkView);
drinkRouter.post('/:drinkId/share', optionalAuth, drinkCtrl.addShare);
drinkRouter.put("/:drinkId/toggle-like", auth,  drinkCtrl.toggleLikeDrink);
drinkRouter.put("/:drinkId/toggle-bookmark", auth, drinkCtrl.toggleBookmarkDrink);

// -------- DELETE --------
drinkRouter.delete('/:id', auth, authEmployee, drinkCtrl.deleteDrink);

export default drinkRouter;