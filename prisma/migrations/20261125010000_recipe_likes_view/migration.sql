CREATE VIEW recipe_likes AS
SELECT user_id, recipe_id
FROM recipe_reactions
WHERE liked;
