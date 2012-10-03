define(['underscore'], function( _ ) {
/**
 * name: name of vote.
 * question: string used to prompt user for vote.
 * onPass: callback triggered if quorum is reached.
 * getVoters: return an array of Players required to establish quorum.
 */
var Vote = function(name, question, getVoters, onPass, onCompleted, onFail) {
  var me = this;
  me.name = name;
  me.question = question;
  me.onPass = onPass || function () {};
  me.onFail = onPass || function () {};
  me.onCompleted = onCompleted || function() {};
  me.getVotersImpl = getVoters;
  me.calculateVote = this.isUnanimous;
  me.votes = {
    'yes': [],
    'no': []
  };

  me.getAllVotes = function() {
    return me.votes.yes + me.votes.no;
  };

  me.printStatus = function(){
    console.log('yes: ', this.votes.yes.length);
    console.log('no: ', this.votes.no.length);
    console.log('required votes: ', this.getVoters().length);
  };

  

};

Vote.prototype.getName = function() { return this.name; };
Vote.prototype.getQuestion = function() { return this.question; };

Vote.prototype.addVote = function(choice, voter) {
  var me = this;
  var isNotDuplicateVoter = function(existingVote) {
    return existingVote !== voter;
  };
  if (_.all(me.votes.yes, isNotDuplicateVoter) &&
     _.all(me.votes.no, isNotDuplicateVoter)) {
    var bucket = me.votes[choice];
    if (bucket) {
      bucket.push(voter);
    }
    console.log('registered vote for ', choice);
    me.printStatus();
    me.determineResult();
  }
};

Vote.prototype.isUnanimous = function() {
  return this.votes.yes.length == this.getVoters().length;
};

Vote.prototype.isMajority = function() {
  return this.votes.yes.length >= this.getVoters().length / 2;
};

Vote.prototype.getVoteCount = function() {
  return this.votes.yes.length + this.votes.no.length;
};

Vote.prototype.getVoters = function() {
  return this.getVotersImpl();
};

Vote.prototype.determineResult = function() {
  if (this.votes.yes.length + this.votes.no.length >= this.getVoters().length) {
    if (this.calculateVote()) {
      this.onPass();
    }
    else {
      this.onFail();
    }
    this.onCompleted();
  }
};

return Vote;
});
