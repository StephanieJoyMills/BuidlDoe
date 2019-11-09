module.exports = (app) => {
  app.on("pull_request_review_comment.created", async (context) => {
    app.log(context);
  });
  app.on("pull_request_review.submitted", async (context) => {
    app.log(context);
  });
  app.on("pull_request.opened"),
    async (context) => {
      app.log(context);
    };
};
