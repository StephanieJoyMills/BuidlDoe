const pullRequests = require("./pull_requests");
const issues = require("./issues");
const newRepo = require("./new_repo");

module.exports = function(app) {
  // app.use(function(err, req, res, next) {
  //   console.log("Something went wrong (┛ಠ_ಠ)┛彡┻━┻");
  //   // based on error code, log differently for dev once logger is set-up
  //   console.log(err);
  //   res.status(err.status || 500);
  //   res.send({ err: err.userMsg });
  // });
  pullRequests(app);
  issues(app);
  newRepo(app);
};
