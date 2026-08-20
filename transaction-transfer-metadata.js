(function(root){
  "use strict";

  const sync=root.ARISE_SYNC;
  const pull=root.ARISE_SYNC_PULL;
  if(!sync||!pull)return;

  const transferKeys=["sourceAccount","destinationAccount","sourceGoalId","targetGoalId"];

  function snapshotTransfer(tx){
    if(!tx||typeof tx!=="object")return null;
    const transfer={};
    for(const key of transferKeys){
      const value=tx[key];
      if(value!==null&&typeof value!=="undefined"&&value!=="")transfer[key]=value;
    }
    return Object.keys(transfer).length?transfer:null;
  }

  function embed(tx){
    const transfer=snapshotTransfer(tx);
    if(!transfer)return false;
    tx.fundingBreakdown={...(tx.fundingBreakdown||{}),transfer:{...transfer}};
    return true;
  }

  function restore(tx){
    if(!tx||typeof tx!=="object")return false;
    const transfer=tx.fundingBreakdown&&tx.fundingBreakdown.transfer;
    if(!transfer||typeof transfer!=="object")return false;
    let changed=false;
    for(const key of transferKeys){
      if((tx[key]===null||typeof tx[key]==="undefined"||tx[key]==="")&&transfer[key]!==null&&typeof transfer[key]!=="undefined"&&transfer[key]!==""){
        tx[key]=transfer[key];changed=true;
      }
    }
    return changed;
  }

  function prepareState(){
    let count=0;
    for(const profile of root.state&&root.state.profiles||[]){
      for(const tx of profile.transactions||[])if(embed(tx))count++;
    }
    return count;
  }

  function restoreState(){
    let count=0;
    for(const profile of root.state&&root.state.profiles||[]){
      for(const tx of profile.transactions||[])if(restore(tx))count++;
    }
    return count;
  }

  const basePush=sync.pushAll.bind(sync);
  sync.pushAll=async function(){prepareState();return basePush();};

  const basePull=pull.pullAll.bind(pull);
  pull.pullAll=async function(){
    const result=await basePull();
    const restored=restoreState();
    if(restored&&typeof root.saveState==="function"){
      root.ARISE_SYNC_SILENT=true;try{root.saveState();}finally{root.ARISE_SYNC_SILENT=false;}
    }
    return {...result,restoredTransferMetadata:restored};
  };

  root.ARISE_TRANSACTION_TRANSFER_METADATA={transferKeys,snapshotTransfer,embed,restore,prepareState,restoreState};
})(typeof globalThis!=="undefined"?globalThis:window);
