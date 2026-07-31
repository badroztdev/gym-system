// src/middleware/validate.js
import { validationResult } from "express-validator";
import { badRequest } from "../utils/response.js";

export const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty())
    return badRequest(res, "بيانات غير صحيحة", errors.array());
  next();
};
