const { body, validationResult } = require("express-validator");
const Game = require("../models/game");
const User = require("../models/user");

exports.game_create_post = [
  // Validate and sanitize
  body(
    "name",
    "Name must be 5 to 25 letters, numbers, spaces (not at start or end) and/or underscores"
  )
    .trim()
    .isLength({ min: 5, max: 25 })
    .matches(/^[A-Za-z0-9_]*$/)
    .escape(),
  async (req, res, next) => {
    // Get validation errors
    var validation_errors = validationResult(req);
    console.log(req.body);

    // Send back errors
    if (!validation_errors.isEmpty()) {
      res.json({ status: "error", errors: validation_errors.errors });
      return;
    }

    // Check that user is not already admin of game with same name
    try {
      const found_game = await Game.findOne({
        admin: req.body.userId,
        name: req.body.name,
      });

      if (found_game) {
        validation_errors.errors.push({
          value: "",
          msg: "You're already an admin for a game with that name",
          param: "name-conflict",
          location: "body",
        });

        res.json({ status: "error", errors: validation_errors.errors });
        return;
      }
    } catch (err) {
      return next(err);
    }

    // Create the game
    var game = new Game({
      name: req.body.name,
      admin: req.body.userId,
    });

    // Save game
    game.save((err) => {
      if (err) {
        return next(err);
      }
    });

    var gameId = game._id;
    console.log(req.body.userId);
    console.log(gameId);

    // Add game to user list
    User.updateOne(
      { id: req.body.userId },
      { $push: { games: gameId } },
      (err) => {
        if (err) {
          return next(err);
        }
        res.json({ status: "ok" });
      }
    );
  },
];
