export const validate = (schemas) => (req, res, next) => {
  for (const key of ['body', 'params', 'query']) {
    if (!schemas[key]) continue;
    const parsed = schemas[key].safeParse(req[key]);
    if (!parsed.success) return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Request validation failed', details: parsed.error.issues.map(({ path, message }) => ({ path: path.join('.'), message })) } });
    if (key === 'query') Object.defineProperty(req, 'query', { value: parsed.data, configurable: true });
    else req[key] = parsed.data;
  }
  next();
};
