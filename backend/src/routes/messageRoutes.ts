import { Router } from "express";
import multer from "multer";
import isAuth from "../middleware/isAuth";
import uploadConfig from "../config/upload";

import * as MessageController from "../controllers/MessageController";

const messageRoutes = Router();

const upload = multer(uploadConfig);

messageRoutes.get("/messages/:ticketId", isAuth, MessageController.index);
// @ts-ignore
messageRoutes.post("/messages/:ticketId", isAuth, upload.array("medias"), MessageController.store);
messageRoutes.get("/messages/getmedia/:ticketId", isAuth, MessageController.GetTicketMedia);
messageRoutes.post("/forwardmessage", isAuth, MessageController.forwardmessage);
messageRoutes.delete("/messages/:messageId", isAuth, MessageController.remove);

messageRoutes.post("/react/messages", isAuth, MessageController.ReactMessage);

messageRoutes.get("/messages-allMe", isAuth, MessageController.allMe);
messageRoutes.post('/message/forward', isAuth, MessageController.forwardMessage)

messageRoutes.post("/messages/edit/:messageId", isAuth, MessageController.edit);

export default messageRoutes;
