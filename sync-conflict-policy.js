(function(root){
  "use strict";

  function timestamp(value){
    const time=new Date(value||0).getTime();
    return Number.isFinite(time)?time:0;
  }

  function resolve({localMeta={},remoteUpdatedAt,localChangedAt}){
    if(localMeta&&localMeta.dirty){
      return {winner:"local",reason:"local_dirty"};
    }

    const remoteTime=timestamp(remoteUpdatedAt);
    const localTime=Math.max(
      timestamp(localChangedAt),
      timestamp(localMeta&&localMeta.changedAt),
      timestamp(localMeta&&localMeta.syncedAt)
    );

    if(remoteTime>localTime){
      return {winner:"remote",reason:"remote_newer"};
    }

    return {winner:"local",reason:"local_newer_or_equal"};
  }

  function mergeObject(localValue,remoteValue,decision){
    return decision&&decision.winner==="remote"
      ? {...localValue,...remoteValue}
      : localValue;
  }

  root.ARISE_SYNC_CONFLICTS={resolve,mergeObject,timestamp};
})(typeof globalThis!=="undefined"?globalThis:window);
