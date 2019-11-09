module.exports = (app) => {
  // Your code here
  app.log("Yay, the app was loaded!");

  app.on("issues.opened", async (context) => {
    app.log(context);
    const issueComment = context.issue({
      body: "Thanks for opening this issue!"
    });
    return context.github.issues.createComment(issueComment);
  });
};
