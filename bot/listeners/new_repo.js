const axios = require("axios");
const _ = require("lodash");
require("dotenv").config();

module.exports = (app) => {
  // fakeInstallation(app);
  // app.on("installation.created", async (context) => {
  //   try {
  //     const owner = context.payload.installation.account.login;
  //     let repoId = context.payload.repositories[0].id;
  //     let repoName = context.payload.repositories[0].name;
  //     let repoPrivacy = context.payload.repositories[0].private;
  //     // if repo is private get an access token and encrypt and store in db** For now we are using one in the env file
  //     //create a URL add on access token if needed i.e. ?access_token=${process.env.ACCESS_TOKEN
  //     if (repoPrivacy) {
  //     }
  //     // use upsert
  //     let repoExists = await getRepo(repoId);
  //     if (!repoExists) {
  //       addRepo(repoId, repoName, repoPrivacy);
  //     }
  //     // Get & store REPO commit data
  //     storeRepoCommitData(repoName, owner);
  //     // Get & store ALL PR data (pr, comments, commits, etc)
  //     storePRData(repoName, owner);
  //   } catch (error) {
  //     app.log(error);
  //   }
  // });
};

async function fakeInstallation(app) {
  // When we add our app to a repo
  try {
    const owner = "StephanieJoyMills";
    let repo = {
      repo_id: 17891,
      name: "Store-API",
      private: false
    };

    // if repo is private get an access token and encrypt and store in db** For now we are using one in the env file
    //create a URL add on access token if needed i.e. ?access_token=${process.env.ACCESS_TOKEN
    if (repo.private) {
    }

    // use upsert
    await upsertRepo(repo);

    // Get & store REPO commit data
    storeRepoCommitData(repo, owner);
    // Get & store ALL PR data (pr, comments, commits, etc)
    storePRData(repo, owner);
  } catch (error) {
    console.log(error);
  }
}

async function storeRepoCommitData(repo, owner) {
  try {
    let commits = (await axios.get(
      `https://api.github.com/repos/${owner}/${repo.name}/commits`
    )).data;
    let parents = [];
    for (let i = commits.length - 1; i >= 0; i--) {
      let objs = await extractCommit(commits[i]);
      parents.push(...objs.parentObjArr);
      await upsertCommit(objs.commitObj);
    }
    console.log("added commits");
    upsertParents(parents);
  } catch (error) {
    console.log(error);
  }
}

function checkUser(data) {
  if (!data.author) {
    return;
  }
  let user = data.author;
  let names = [...data.commit.author.name.split(" ")];
  if (names.length !== 2) {
    names = [null, null];
  }

  let userObj = {
    user_id: user.id,
    github_name: user.login,
    avatar_url: user.avatar_url,
    profile_url: user.html_url,
    first_name: names[0],
    last_name: names[1],
    email: data.commit.author.email,
    event_added: "commit"
  };
  return upsertUser(userObj);
}

async function extractCommit(commitData) {
  try {
    await checkUser(commitData);

    let parentObjArr = commitData.parents.map(function(parent) {
      return {
        parent_sha: parent.sha,
        child_sha: commitData.sha
      };
    });

    return (reviewObj = {
      parentObjArr,
      commitObj: {
        url: commitData.html_url,
        created_at: commitData.commit.author.date,
        sha: commitData.sha,
        user_id: commitData.author.id,
        message: commitData.commit.message
      }
    });
  } catch (error) {
    console.log(error);
  }
}

async function storePRData(repo, owner) {
  let prs = (await axios.get(
    `https://api.github.com/repos/${owner}/${repo.name}/pulls`
  )).data;
  let prPromises = prs.map(async function(pr) {
    await loopThroughPRs(pr, repo, owner);
    return;
  });
  return;
}

async function loopThroughPRs(pr, repo, owner) {
  try {
    await checkUser(pr.user);
    // Add prs
    let baseUrl = `https://api.github.com/repos/${owner}/${repo.name}`;
    prObj = {
      pull_request_id: pr.id,
      url: pr.html_url,
      title: pr.title,
      body: pr.body,
      number: pr.number,
      state: pr.state,
      branch: pr.base.ref,
      base: pr.base.ref,
      created_at: pr.created_at,
      updated_at: pr.updated_at,
      closed_at: pr.closed_at,
      merged_at: pr.merged_at,
      created_by: pr.user.id,
      repo_id: repo.id
    };
    await addPR(prObj);

    // add non-review comments
    addEvent(
      baseUrl + `/issues/${pr.number}/comments`,
      loopThroughComments,
      addComment,
      pr.id
    );

    // add commits from pr
    res = await axios.get(
      `https://api.github.com/repos/${owner}/${repo.name}/pulls/${pr.number}/commits`
    );
    let parents = [];
    for (let i = res.data.length - 1; i >= 0; i--) {
      let commitObj = await loopThroughCommits(res.data[i]);
      parents.push(...commitObj.promiseArr);
      await addCommit(commitObj.obj);
    }
    await addParent(parents);

    // add reviews
    await addEvent(
      baseUrl + `/pulls/${pr.number}/reviews`,
      loopThroughReviews,
      addReview,
      pr.id
    );

    // add review comments
    res = await axios.get(
      `https://api.github.com/repos/${owner}/${repo.name}/pulls/${pr.number}/comments`
    );
    let replies = new Map();
    for (let i = res.data.length - 1; i >= 0; i--) {
      let newMap = await loopThroughReviewComments(res.data[i], pr.id, replies);
      if (newMap) {
        replies = newMap;
      }
    }
    await addReviewReplies(replies);
    return;
  } catch (error) {
    console.log("in err");
    console.log(error);
  }
}
async function loopThroughCommits(commitObj) {
  await checkUser(commitObj.committer);
  let promiseArr = await addCommitParents(commitObj.parents, commitObj.sha);
  return (reviewObj = {
    promiseArr,
    obj: {
      commit_sha: commitObj.sha,
      user_id: commitObj.committer.id,
      url: commitObj.html_url,
      created_at: commitObj.commit.committer.date,
      message: commitObj.commit.message
    }
  });
}

//goes into two tables now
async function loopThroughReviewComments(comment, prId, replies) {
  console.log("looping through review comment");
  console.log(comment);
  await checkUser(comment.user);
  if (comment.in_reply_to_id) {
    let newReply = {
      comment_id: comment.id,
      body: comment.body,
      created_at: comment.created_at,
      updated_at: comment.updated_at,
      pull_request_id: prId,
      user_name: comment.user.login,
      avatar_url: comment.user.avatar_url,
      profile_url: comment.user.html_url
    };
    let replyToId = comment.in_reply_to_id;
    if (replies.has(replyToId)) {
      let repliesArr = replies.get(replyToId);
      repliesArr.push(newReply);
      replies.set(replyToId, repliesArr);
    } else {
      let replyArr = [newReply];
      replies.set(replyToId, replyArr);
    }
    return replies;
  } else {
    newComment = {
      commentObj: {
        comment_id: comment.id,
        url: comment.html_url,
        body: comment.body,
        created_at: comment.created_at,
        updated_at: comment.updated_at,
        pull_request_id: prId,
        user_id: comment.user.id,
        is_review_comment: true
      },
      reviewCommentObj: {
        diff_hunk: comment.diff_hunk,
        path: comment.path,
        position: comment.position,
        original_position: comment.original_position,
        commit_sha: comment.commit_id,
        original_commit_sha: comment.original_commit_id,
        review_id: comment.pull_request_review_id,
        comment_id: comment.id,
        created_by: 1,
        replies: JSON.stringify([])
      }
    };
    await addReviewComment(newComment);
  }
  return null;
}

async function loopThroughComments(comment, prId) {
  await checkUser(comment.user);
  return (commentObj = {
    comment_id: comment.id,
    comment_url: comment.html_url,
    body: comment.body,
    created_at: comment.created_at,
    updated_at: comment.updated_at,
    pull_request_id: prId,
    user_id: comment.user.id
  });
}

async function loopThroughReviews(review, prId) {
  await checkUser(review.user);
  return (reviewObj = {
    review_id: review.id,
    user_id: review.user.id,
    url: review.html_url,
    body: review.body,
    state: review.state,
    commit_sha: review.commit_id,
    submitted_at: review.submitted_at,
    pull_request_id: prId
  });
}

async function addEvent(url, loopFunc, addFunc, prId) {
  res = await axios.get(url);
  res.data.map(async function(event) {
    let eventObj = await loopFunc(event, prId);
    await addFunc(eventObj);
    return;
  });
  console.log("successfully added objects from", url);
  return;
}
