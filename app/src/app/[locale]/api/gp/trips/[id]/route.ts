import {
  GET as coreGET,
  PATCH as corePATCH,
  DELETE as coreDELETE,
} from "@/app/api/gp/trips/[id]/route";

export const GET = coreGET;
export const PATCH = corePATCH;
export const DELETE = coreDELETE;
