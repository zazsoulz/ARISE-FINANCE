(function(root){
  "use strict";

  function timestamp(value){
    const time=new Date(value||0).getTime();
    return Number.isFinite(time)?time:0;
  }

  function clearConflict(localMeta){
    if(localMeta&&localMeta.conflict) delete localMeta.conflict;
  }

  function resolve({localMeta={},remoteUpdatedAt,localChangedAt}){
    const remoteTime=timestamp(remoteUpdatedAt);
    const syncedTime=timestamp(localMeta&&localMeta.syncedAt);
    const changedTime=Math.max(
      timestamp(localChangedAt),
      timestamp(localMeta&&localMeta.changedAt)
    );

    if(localMeta&&localMeta.dirty){
      if(syncedTime>0&&remoteTime>syncedTime){
        const conflict={
          reason:"concurrent_remote_change",
          baseSyncedAt:localMeta.syncedAt||null,
          localChangedAt:localMeta.changedAt||localChangedAt||null,
          remoteUpdatedAt:remoteUpdatedAt||null,
          detectedAt:new Date().toISOString()
        };
        localMeta.conflict=conflict;
        return {winner:"conflict",reason:conflict.reason,baseTime:syncedTime,localTime:changedTime,remoteTime,conflict};
      }
      clearConflict(localMeta);
      return {winner:"local",reason:"local_dirty",baseTime:syncedTime,localTime:changedTime,remoteTime};
    }

    clearConflict(localMeta);
    const localTime=Math.max(changedTime,syncedTime);
    if(remoteTime>localTime){
      return {winner:"remote",reason:"remote_newer",baseTime:syncedTime,localTime,remoteTime};
    }

    return {winner:"local",reason:"local_newer_or_equal",baseTime:syncedTime,localTime,remoteTime};
  }

  function mergeObject(localValue,remoteValue,decision){
    return decision&&decision.winner==="remote"
      ? {...localValue,...remoteValue}
      : localValue;
  }

  function isConflict(decision){
    return !!decision&&decision.winner==="conflict";
  }

  root.ARISE_SYNC_CONFLICTS={resolve,mergeObject,timestamp,isConflict};
})(typeof globalThis!=="undefined"?globalThis:window);
