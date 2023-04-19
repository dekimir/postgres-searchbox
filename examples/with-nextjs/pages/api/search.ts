// During postgres-searchbox development this can be:
import { searchHandler } from '../../../../package/build';
// Otherwize you should use:
// import { searchHandler } from 'postgres-searchbox';

import type { NextApiRequest, NextApiResponse } from 'next';

export default (req: NextApiRequest, res: NextApiResponse) =>
  searchHandler(req, res);
