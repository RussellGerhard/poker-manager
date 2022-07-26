const { body, validationResult } = require("express-validator");
const Game = require("../models/game");
const Session = require("../models/session");
const User = require("../models/user");
const Notification = require("../models/notification");
const Post = require("../models/post");
const he = require("he");
const notification = require("../models/notification");

// DONT CONFUSE req.session (user session for auth) with
// game.session (upcoming meetup of a poker game), sorry!

// Get details of game
exports.game_details_get = async (req, res, next) => {
  try {
    const game = await Game.findById(req.params.gameId).populate([
      "members",
      "session",
      "admin",
    ]);
    game.members.sort((a, b) => {
      // Positive return means a after b
      // Negative return means b after a
      // 0 return means original order
      return (
        game.member_profit_map.get(b._id) - game.member_profit_map.get(a._id)
      );
    });
    const isAdmin = game.admin.equals(req.session.user._id);
    res.json({ status: "ok", game: game, isAdmin: isAdmin });
  } catch (err) {
    return next(err);
  }
};

// Get posts of game message board
exports.game_posts_get = async (req, res, next) => {
  try {
    const posts = await Post.find({ game: req.params.gameId })
      .populate("author")
      .sort({ date: "desc" });
    res.json({ status: "ok", posts: posts });
  } catch (err) {
    return next(err);
  }
};

// Get all games associated with a user
exports.game_list_get = async (req, res, next) => {
  try {
    const user = await User.findById(req.session.user._id);

    // Get a list of games objects
    const game_links = [];
    for (game_id of user.games) {
      const game = await Game.findById(game_id).populate("session");
      game_links.push({
        _id: game._id,
        name: game.name,
        admin: game.admin,
        profit: game.member_profit_map.get(user._id),
        session: game.session,
        url: game.url,
      });
    }

    // Sort games by greatest profit
    game_links.sort((a, b) => {
      return b.profit - a.profit;
    });

    // Respond with names and links of games
    res.json({ status: "ok", games: game_links });
    return;
  } catch (err) {
    return next(err);
  }
};

// Post an update to member's profit
exports.update_profit_post = [
  body("gameId").escape(),
  body("memberId").escape(),
  body("profit").isNumeric().escape(),
  async (req, res, next) => {
    // Get validation errors
    const validation_errors = validationResult(req);

    // Send back errors
    if (!validation_errors.isEmpty()) {
      res.json({ status: "error", errors: validation_errors.errors });
      return;
    }

    try {
      // Clean profit to dollars and cents amount
      const profit = Number(req.body.profit).toFixed(2);

      // Update profit
      await Game.findByIdAndUpdate(req.body.gameId, {
        $set: {
          [`member_profit_map.${req.body.memberId}`]: profit,
        },
      });
      res.json({ status: "ok" });
    } catch (err) {
      return next(err);
    }
  },
];

// Post a new message to the game message board
exports.new_message_post = [
  // Val and sanitize
  body("gameId").escape(),
  body("message", "Message must be between 1 and 140 characters")
    .trim()
    .isLength({ min: 1, max: 140 })
    .escape(),
  async (req, res, next) => {
    // Get validation errors
    const validation_errors = validationResult(req);

    // Send back errors
    if (!validation_errors.isEmpty()) {
      res.json({ status: "error", errors: validation_errors.errors });
      return;
    }

    try {
      // Members other than admin capped at 2 posts
      const game = await Game.findById(req.body.gameId);

      if (!game.admin.equals(req.session.user._id)) {
        const posts = await Post.find({
          game: req.body.gameId,
          author: req.session.user._id,
        });
        if (posts.length > 1) {
          res.json({
            status: "error",
            errors: [
              {
                param: "TooManyMesssages",
                msg: "Posts are capped at two per member",
              },
            ],
          });
          return;
        }
      }
      // Create new post and save it
      const post = new Post({
        author: req.session.user._id,
        game: req.body.gameId,
        body: req.body.message,
        date: Date.now(),
      });
      await post.save();

      // Notify members of new post (except author)
      for (member of game.members) {
        if (!member.equals(req.session.user._id)) {
          const notification = new Notification({
            sender: req.session.user._id,
            recipient: member,
            game: game._id,
            label: "New Message",
            message: `${req.session.user.username} posted in ${he.decode(
              game.name
            )}`,
            date: Date.now(),
          });
          await notification.save();
        }
      }

      res.json({ status: "ok" });
    } catch (err) {
      return next(err);
    }
  },
];

// Delete a post in game board
exports.delete_message_post = [
  // Validate and sanitize
  body("gameId").escape(),
  body("postId").escape(),
  async (req, res, next) => {
    try {
      // Check that user is admin or author
      const game = await Game.findById(req.body.gameId);
      const post = await Post.findById(req.body.postId);

      if (
        !(
          game.admin.equals(req.session.user._id) ||
          post.author.equals(req.session.user._id)
        )
      ) {
        res.json({
          status: "error",
          errors: [
            {
              param: "NotAdminOrAuthor",
              msg: "You cannot delete a post unless you are the author or the game admin",
            },
          ],
        });
        return;
      }

      // User is authed, so delete the post
      await Post.findByIdAndDelete(req.body.postId);
      res.json({ status: "ok" });
    } catch (err) {
      return next(err);
    }
  },
];

// Join session
exports.join_session_post = [
  body("gameId").escape(),
  async (req, res, next) => {
    try {
      const game = await Game.findById(req.body.gameId).populate(["session"]);
      if (game.session.rsvp_map.get(req.session.user._id) === "accepted") {
        res.json({
          status: "error",
          errors: [
            {
              param: "Joined",
              msg: "You have already joined the session",
            },
          ],
        });
        return;
      }

      const invite = await Notification.findOneAndDelete({
        recipient: req.session.user._id,
        label: "Session Invite",
        game: req.body.gameId,
      });

      // Members need invite to join
      if (!invite && req.session.user._id != game.admin) {
        res.json({
          status: "error",
          errors: [
            {
              param: "NoSessionInvite",
              msg: "You do not have an invite to this session",
            },
          ],
        });
        return;
      }

      // Join the session
      await Session.findByIdAndUpdate(game.session._id, {
        $set: {
          [`rsvp_map.${req.session.user._id}`]: "accepted",
        },
      });

      res.json({ status: "ok" });
    } catch (err) {
      return next(err);
    }
  },
];

// Leave session
exports.leave_session_post = [
  body("gameId").escape(),
  async (req, res, next) => {
    try {
      const game = await Game.findById(req.body.gameId).populate(["session"]);
      if (game.session.rsvp_map.get(req.session.user._id) != "accepted") {
        res.json({
          status: "error",
          errors: [
            {
              param: "NotJoined",
              msg: "You haven't joined the session",
            },
          ],
        });
        return;
      }

      await Session.findByIdAndUpdate(game.session._id, {
        $set: {
          [`rsvp_map.${req.session.user._id}`]: "declined",
        },
      });
      res.json({ status: "ok" });
    } catch (err) {
      return next(err);
    }
  },
];

// Remove a member from a session
exports.remove_session_member_post = [
  body("gameId").escape(),
  body("memberId").escape(),
  async (req, res, next) => {
    try {
      const game = await Game.findById(req.body.gameId).populate([
        "admin",
        "session",
      ]);

      // Member is not RSVPed
      const member = await User.findById(req.body.memberId);
      if (game.session.rsvp_map.get(req.body.memberId) !== "accepted") {
        res.json({
          status: "error",
          errors: [
            {
              param: "MemberNotRSVPed",
              msg: `${member.username} has not RSVPed for this game's session`,
            },
          ],
        });
        return;
      }

      // Unset member RSVP status in session
      await Session.findByIdAndUpdate(game.session._id, {
        $unset: {
          [`rsvp_map.${req.body.memberId}`]: "",
        },
      });

      // Create notification that RSVP was revoked
      const notification = new Notification({
        sender: game.admin._id,
        recipient: req.body.memberId,
        game: req.body.gameId,
        label: "Session RSVP Revoked",
        message: `${game.admin.username} revoked your RSVP status for a session of their poker game, ${game.name}, at ${game.session.time} on ${game.session.date}`,
        date: Date.now(),
      });

      await notification.save();
      res.json({ status: "ok", memberName: member.username });
    } catch (err) {
      return next(err);
    }
  },
];

// Invite a member to a session
exports.send_rsvp_invite_post = [
  body("gameId").escape(),
  body("memberId").escape(),
  async (req, res, next) => {
    try {
      const game = await Game.findById(req.body.gameId).populate([
        "admin",
        "session",
      ]);

      // Member not RSVPed or already invited
      const member = await User.findById(req.body.memberId);
      if (game.session.rsvp_map.get(req.body.memberId) === "accepted") {
        res.json({
          status: "error",
          errors: [
            {
              param: "MemberRSVPed",
              msg: `${member.username} has already RSVPed for this game's session`,
            },
          ],
        });
        return;
      }

      const invite = await Notification.findOne({
        recipient: req.body.memberId,
        label: "Session Invite",
        game: req.body.gameId,
      });

      if (invite) {
        res.json({
          status: "error",
          errors: [
            {
              param: "MemberInvitePending",
              msg: `${member.username} has a pending invite for this game's session`,
            },
          ],
        });
        return;
      }

      // Set member RSVP status to invited in session
      await Session.findByIdAndUpdate(game.session._id, {
        $set: {
          [`rsvp_map.${req.body.memberId}`]: "invited",
        },
      });

      // Create notification to RSVP for the session!
      const notification = new Notification({
        sender: game.admin._id,
        recipient: req.body.memberId,
        game: req.body.gameId,
        label: "Session Invite",
        message: `${game.admin.username} asked you to RSVP for a session of their poker game, ${game.name}, at ${game.session.time} on ${game.session.date}`,
        date: Date.now(),
      });

      await notification.save();
      res.json({ status: "ok", memberName: member.username });
    } catch (err) {
      return next(err);
    }
  },
];

// Accept RSVP
exports.member_accept_rsvp_post = [
  body("gameId").escape(),
  async (req, res, next) => {
    try {
      const invite = await Notification.findOneAndDelete({
        recipient: req.session.user,
        label: "Session Invite",
        game: req.body.gameId,
      });

      if (!invite) {
        res.json({
          status: "error",
          errors: [
            {
              param: "NoSessionInvite",
              msg: "Cannot RSVP to game, you don't have an invite",
            },
          ],
        });
        return;
      }

      // Update game
      const game = await Game.findById(req.body.gameId);
      await Session.findByIdAndUpdate(game.session, {
        $set: {
          [`rsvp_map.${req.session.user._id}`]: "accepted",
        },
      });

      res.json({ status: "ok", game: game.name });
    } catch (err) {
      return next(err);
    }
  },
];

// Decline RSVP
exports.member_decline_rsvp_post = [
  body("gameId").escape(),
  async (req, res, next) => {
    try {
      const invite = await Notification.findOneAndDelete({
        recipient: req.session.user,
        label: "Session Invite",
        game: req.body.gameId,
      });

      if (!invite) {
        res.json({
          status: "error",
          errors: [
            {
              param: "NoSessionInvite",
              msg: "Cannot decline to RSVP to game, you don't have an invite",
            },
          ],
        });
        return;
      }

      // Update game
      const game = await Game.findById(req.body.gameId);
      await Session.findByIdAndUpdate(game.session, {
        $set: {
          [`rsvp_map.${req.session.user._id}`]: "declined",
        },
      });
      res.json({ status: "ok", game: game.name });
    } catch (err) {
      return next(err);
    }
  },
];

// Delete a session
exports.delete_session_post = [
  body("gameId").escape(),
  body("userId").escape(),
  async (req, res, next) => {
    try {
      // Delete session invites
      await Notification.deleteMany({
        game: req.body.gameId,
        label: "Session Invite",
      });

      // Update game to remove session
      const game = await Game.findByIdAndUpdate(req.body.gameId, {
        $unset: { session: "" },
      });

      // Delete session
      await Session.findByIdAndDelete(game.session);

      res.json({ status: "ok" });
    } catch (err) {
      return next(err);
    }
  },
];

// Add a member
exports.add_member_post = [
  // Validate and sanitize
  body(
    "username",
    "Username must be 3 to 20 letters, numbers, and/or underscores"
  )
    .trim()
    .isLength({ min: 3, max: 20 })
    .matches(/^[A-Za-z0-9_]*$/)
    .escape(),
  async (req, res, next) => {
    // Get validation errors
    const validation_errors = validationResult(req);

    // Send back errors
    if (!validation_errors.isEmpty()) {
      res.json({ status: "error", errors: validation_errors.errors });
      return;
    }

    // Check that user is not inviting themself
    if (req.body.username === req.session.user.username) {
      res.json({
        status: "error",
        errors: [{ param: "SameUser", msg: "You cannot invite yourself" }],
      });
      return;
    }

    // Find user and game
    const user = await User.findOne({ username: req.body.username });
    const game = await Game.findById(req.body.gameId);

    // user ? send notification : respond with error
    if (user) {
      // Check that invite isn't already out there
      const existing_invite = await Notification.findOne({
        recipient: user._id,
        game: req.body.gameId,
        label: "Game Invite",
      });

      if (existing_invite) {
        res.json({
          status: "error",
          errors: [
            {
              param: "ExistingInvite",
              msg: `${user.username} already has an invitation to this game`,
            },
          ],
        });
        return;
      }

      const notification = new Notification({
        sender: req.session.user._id,
        recipient: user._id,
        game: req.body.gameId,
        label: "Game Invite",
        message: `${
          req.session.user.username
        } invited you to their poker game: ${he.decode(game.name)}`,
        date: Date.now(),
      });

      try {
        notification.save();
        res.json({ status: "ok" });
      } catch (err) {
        return next(err);
      }
    } else {
      res.json({
        status: "error",
        errors: [
          {
            param: "NoUser",
            msg: "No account found with that username (usernames are case sensitive)",
          },
        ],
      });
    }
  },
];

// Create and update session
exports.session_form_post = [
  // Validate and sanitize
  body("date", "Required input date must be between 1 and 20 characters")
    .trim()
    .isLength({ min: 1, max: 20 })
    .matches(/^[A-Za-z0-9/\-\. ]*$/)
    .escape(),
  body(
    "time",
    "Required input time must be between 1 and 20 letters, numbers, colons, and/or spaces (not at start or end)"
  )
    .trim()
    .isLength({ min: 1, max: 20 })
    .matches(/^[A-Za-z0-9: ]*$/)
    .escape(),
  body(
    "address",
    "Required input address must be between 1 and 30 characters long"
  )
    .trim()
    .isLength({ min: 1, max: 30 })
    .escape(),
  async (req, res, next) => {
    // Get validation errors
    var validation_errors = validationResult(req);

    // Send back errors
    if (!validation_errors.isEmpty()) {
      res.json({ status: "error", errors: validation_errors.errors });
      return;
    }

    // Get game
    const game = await Game.findById(req.body.gameId);

    // Using form to create new session
    if (!req.body.sessionId) {
      // Check that game doesn't already have session
      try {
        if (game?.session) {
          validation_errors.errors.push({
            value: "",
            msg: "This game already has a session in progress",
            param: "session-exists",
            location: "body",
          });

          res.json({ status: "error", errors: validation_errors.errors });
          return;
        }
      } catch (err) {
        return next(err);
      }

      // Create the session
      const session = new Session({
        game: game._id,
        date: req.body.date,
        time: req.body.time,
        address: req.body.address,
        rsvp_map: {},
      });

      // Save session
      session.save((err) => {
        if (err) {
          return next(err);
        }
      });

      // Add session to game
      Game.findByIdAndUpdate(
        req.body.gameId,
        { $set: { session: session._id } },
        (err) => {
          if (err) {
            return next(err);
          }
          res.json({ status: "ok", gameId: req.body.gameId });
        }
      );
    } else {
      try {
        // Using form to update existing session
        await Session.findByIdAndUpdate(req.body.sessionId, {
          $set: {
            date: req.body.date,
            time: req.body.time,
            address: req.body.address,
          },
        });
        res.json({ status: "ok", gameId: req.body.gameId });
      } catch (err) {
        return next(err);
      }
    }
  },
];

// Create and update game
exports.game_form_post = [
  // Validate and sanitize
  body(
    "name",
    "Name must be 5 to 20 letters, numbers, apostrophes, and/or spaces (not at start or end)"
  )
    .trim()
    .isLength({ min: 5, max: 20 })
    .matches(/^[A-Za-z0-9'’ ]*$/)
    .escape(),
  body(
    "game_type",
    "Game type must be less than 20 letters, numbers, apostrophes and/or spaces (not at start or end)"
  )
    .trim()
    .isLength({ max: 20 })
    .matches(/^[A-Za-z0-9'’ ]*$/)
    .escape(),
  body("stakes", "Stakes must be less than 20 characters long")
    .trim()
    .isLength({ max: 20 })
    .escape(),
  body("max_buyin", "Max buyin must be less than 20 characters long")
    .trim()
    .isLength({ max: 20 })
    .escape(),
  body("venmoEnabled").escape(),
  body("venmoUsername", "Please enter a valid Venmo username")
    .if((value, { req }) => {
      req.venmoEnabled === "true";
    })
    .trim()
    .isLength({ min: 5, max: 30 })
    .matches(/^[A-Za-z0-9-_]*$/)
    .escape(),
  body("venmoMessage").trim().escape(),
  async (req, res, next) => {
    // Get validation errors
    var validation_errors = validationResult(req);

    // Send back errors
    if (!validation_errors.isEmpty()) {
      res.json({ status: "error", errors: validation_errors.errors });
      return;
    }

    // Check that venmoUsername provided if venmoEnabled is on
    if (req.body.venmoEnabled === "true") {
      if (!req.body.venmoUsername) {
        res.json({
          status: "error",
          errors: [
            {
              param: "NoBanker",
              msg: "To enable Venmo, please provide the Venmo username of the banker for the game.",
            },
          ],
        });
        return;
      }
      if (!req.body.venmoMessage) {
        res.json({
          status: "error",
          errors: [
            {
              param: "NoMessage",
              msg: "To enable Venmo, please provide a message under 50 characters for Venmo requests associated with your game",
            },
          ],
        });
        return;
      }
    }

    try {
      // Using form to create new game
      if (!req.body.gameId) {
        // Check that user is not already admin of game with same name
        const found_game = await Game.findOne({
          admin: req.session.user._id,
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

        // Create the game
        const game = new Game({
          name: req.body.name,
          game_type: req.body.game_type,
          stakes: req.body.stakes,
          max_buyin: req.body.max_buyin,
          venmoEnabled: req.body.venmoEnabled,
          bankerVenmo: req.body.venmoUsername,
          venmoMessage: req.body.venmoMessage,
          members: [req.session.user._id],
          // computed property name syntax
          member_profit_map: { [req.session.user._id]: 0 },
          admin: req.session.user._id,
        });

        // Save game
        await game.save();

        // Add game to user list
        await User.findByIdAndUpdate(req.session.user._id, {
          $push: { games: game._id },
        });
        res.json({ status: "ok", gameId: game._id });
      } else {
        // Using form to update existing game
        await Game.findByIdAndUpdate(req.body.gameId, {
          $set: {
            name: req.body.name,
            game_type: req.body.game_type,
            stakes: req.body.stakes,
            max_buyin: req.body.max_buyin,
            venmoEnabled: req.body.venmoEnabled === "true" ? true : false,
            bankerVenmo: req.body.venmoUsername,
            venmoMessage: req.body.venmoMessage,
          },
        });
        res.json({ status: "ok", gameId: req.body.gameId });
      }
    } catch (err) {
      return next(err);
    }
  },
];

// Leave game
exports.leave_game_post = async (req, res, next) => {
  try {
    // Remove user from member list and profit tracking
    await Game.findByIdAndUpdate(req.body.gameId, {
      $pull: {
        members: req.session.user._id,
      },
      $unset: {
        [`member_profit_map.${req.session.user._id}`]: 0,
      },
    });

    // Remove game from user's list
    const game = await Game.findById(req.body.gameId);
    await User.findByIdAndUpdate(req.session.user._id, {
      $pull: {
        games: req.body.gameId,
      },
    });

    // Remove user from session
    if (game?.session) {
      await Session.findByIdAndUpdate(game.session, {
        $unset: {
          [`rsvp_map.${req.session.user._id}`]: "",
        },
      });
    }

    // Remove any notifications that have to do with this user in this game
    await Notification.deleteMany({
      recipient: req.session.user._id,
      game: req.body.gameId,
    });

    // Notify game admin
    const notification = new Notification({
      sender: req.session.user._id,
      recipient: game.admin,
      game: req.body.gameId,
      label: "Game Notice",
      message: `${req.session.user.username} left your poker game: ${he.decode(
        game.name
      )}`,
      date: Date.now(),
    });

    await notification.save();
    res.json({ status: "ok" });
  } catch (err) {
    return next(err);
  }
};

// Kick member
exports.kick_member_post = [
  body("gameId").escape(),
  body("userId").escape(),
  async (req, res, next) => {
    try {
      // Remove user from member list and profit tracking
      await Game.findByIdAndUpdate(req.body.gameId, {
        $pull: {
          members: req.body.userId,
        },
        $unset: {
          [`member_profit_map.${req.body.userId}`]: 0,
        },
      });

      // Remove game from member list
      await User.findByIdAndUpdate(req.body.userId, {
        $pull: {
          games: req.body.gameId,
        },
      });

      // Remove user from session
      const game = await Game.findById(req.body.gameId).populate("admin");
      if (game?.session) {
        await Session.findByIdAndUpdate(game.session, {
          $unset: {
            [`rsvp_map.${req.body.userId}`]: "",
          },
        });
      }

      // Remove any notifications that have to do with this user in this game
      await Notification.deleteMany({
        recipient: req.body.userId,
        game: req.body.gameId,
      });

      // Notify member that they've been removed
      const notification = new Notification({
        sender: game.admin._id,
        recipient: req.body.userId,
        game: req.body.gameId,
        label: "Game Notice",
        message: `${
          game.admin.username
        } kicked you from their poker game: ${he.decode(game.name)}`,
        date: Date.now(),
      });

      await notification.save();
      res.json({ status: "ok" });
    } catch (err) {
      return next(err);
    }
  },
];

// Delete game
exports.delete_game_post = [
  body("gameId").escape(),
  body("userId").escape(),
  async (req, res, next) => {
    try {
      // Delete game
      const game = await Game.findByIdAndDelete(req.body.gameId);

      // Delete game session
      if (game?.session) {
        await Session.findByIdAndDelete(game.session);
      }

      // Delete any notifications for that game
      await Notification.deleteMany({
        game: req.body.gameId,
        label: { $not: { $eq: "Venmo Cashout" } },
      });

      // Delete any posts for that game
      await Post.deleteMany({
        game: req.body.gameId,
      });

      for (member of game.members) {
        // Delete game for all members' game lists
        await User.findByIdAndUpdate(member, { $pull: { games: game._id } });

        // Notify members (except admin)
        if (member.equals(game.admin)) {
          continue;
        } else {
          const notification = new Notification({
            sender: req.session.user._id,
            recipient: member,
            game: game._id,
            label: "Game Deleted",
            message: `${
              req.session.user.username
            } deleted their poker game: ${he.decode(game.name)}`,
            date: Date.now(),
          });
          await notification.save();
        }
      }
      res.json({ status: "ok" });
    } catch (err) {
      return next(err);
    }
  },
];

// Join game from invite notification
exports.join_game_post = [
  body("gameId").escape(),
  async (req, res, next) => {
    try {
      // Validate existence of invite
      const invite = await Notification.findOne({
        recipient: req.session.user._id,
        game: req.body.gameId,
        label: "Game Invite",
      });

      // No invite, send error
      if (!invite) {
        res.json({
          status: "error",
          errors: [
            {
              param: "NoInvite",
              msg: "You do not have an invitation for that game",
            },
          ],
        });
      } else {
        // Add player to game
        await Game.findByIdAndUpdate(req.body.gameId, {
          $push: {
            members: req.session.user._id,
          },
          // brackets allow variable in mongoose field
          // dot notation to specify field
          // template string to construct full key
          // yeesh
          $set: {
            [`member_profit_map.${req.session.user._id}`]: "0",
          },
        });

        // Add game to player's game list
        await User.findByIdAndUpdate(req.session.user._id, {
          $push: {
            games: req.body.gameId,
          },
        });

        // Remove notification
        await Notification.findOneAndDelete({
          recipient: req.session.user._id,
          game: req.body.gameId,
          label: "Game Invite",
        });

        // Return
        res.json({ status: "ok" });
      }
    } catch (err) {
      return next(err);
    }
  },
];

// Submit cashout at end of session
exports.submit_cashout_post = async (req, res, next) => {
  try {
    const game = await Game.findById(req.body.gameId);
    var net_profit, cashout, buyin;
    for (player of req.body.players) {
      // Compute profit, update profit map in game
      buyin = parseInt(req.body.player_cashout_map[player._id].buyin);
      cashout = parseInt(req.body.player_cashout_map[player._id].cashout);
      net_profit = cashout - buyin;
      await Game.findByIdAndUpdate(req.body.gameId, {
        $set: {
          [`member_profit_map.${player._id}`]:
            game.member_profit_map.get(player._id) + net_profit,
        },
      });

      // If using Venmo, send a notification with a venmo link
      if (req.body.player_cashout_map[player._id].useVenmo) {
        // link goes into message, and message is going to be used to SET INNER HTML
        // very important that all of these input are escaped with BACKEND validation before use
        // or user is exposed to XSS
        const link = `https://venmo.com/?txn=charge&amp;audience=private&amp;recipients=${
          game.bankerVenmo
        }&amp;amount=${cashout}&amp;note=${game.venmoMessage.replace(
          " ",
          "%20"
        )}`;
        const message = `You cashed out of a session of ${req.session.user.username}'s poker game, ${game.name}, with $${cashout}. Here's a link to <a href=${link} target="_blank">request your cash</a> via Venmo.`;
        const notification = new Notification({
          sender: req.session.user._id,
          recipient: player._id,
          game: req.body.gameId,
          label: "Venmo Cashout",
          message: message,
          date: Date.now(),
        });

        await notification.save();
      }
    }

    // Delete session
    await Session.findByIdAndDelete(game.session);

    // Remove session from game
    await Game.findByIdAndUpdate(req.body.gameId, {
      $unset: {
        session: "",
      },
    });

    // Delete any pending session invites
    await Notification.deleteMany({
      game: req.body.gameId,
      label: "Session Invite",
    });

    res.json({ status: "ok" });
  } catch (err) {
    return next(err);
  }
};

exports.session_exists = [
  body("gameId").escape(),
  async (req, res, next) => {
    try {
      const game = await Game.findById(req.body.gameId);
      if (!game?.session) {
        res.json({
          status: "error",
          errors: [
            {
              param: "NoSession",
              msg: "This game does not have a session",
            },
          ],
        });
      } else {
        next();
      }
    } catch (err) {
      return next(err);
    }
  },
];

exports.is_admin = [
  body("gameId").escape(),
  async (req, res, next) => {
    try {
      const game = await Game.findById(req.body.gameId);
      if (!game.admin.equals(req.session.user._id)) {
        res.json({
          status: "error",
          errors: [
            {
              param: "NotAdmin",
              msg: "You are not the admin of this game",
            },
          ],
        });
      } else {
        next();
      }
    } catch (err) {
      return next(err);
    }
  },
];

exports.is_member_post = [
  body("gameId").escape(),
  async (req, res, next) => {
    try {
      const game = await Game.findById(req.body.gameId);
      if (!game.members.includes(req.session.user._id)) {
        res.json({
          status: "error",
          errors: [
            {
              param: "NotMember",
              msg: "You are not a member of this game",
            },
          ],
        });
      } else {
        next();
      }
    } catch (err) {
      return next(err);
    }
  },
];

exports.is_member_params = async (req, res, next) => {
  try {
    const game = await Game.findById(req.params.gameId);
    if (!game.members.includes(req.session.user._id)) {
      res.json({
        status: "error",
        errors: [
          {
            param: "NotMember",
            msg: "You are not a member of this game",
          },
        ],
      });
    } else {
      next();
    }
  } catch (err) {
    return next(err);
  }
};
