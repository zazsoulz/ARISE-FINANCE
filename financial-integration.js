(function(root){
  "use strict";

  const core = root.ARISE_FINANCE_CORE;

  if(!core){
    console.error("ARISE financial core is not available.");
    return;
  }

  function categoryName(profile,id){
    const category = (profile.categories || []).find(
      item => String(item.id) === String(id)
    );

    if(category && category.name){
      return category.name;
    }

    for(const tx of profile.transactions || []){
      for(const allocation of tx.allocations || []){
        if(
          String(allocation.categoryId) === String(id) &&
          allocation.name
        ){
          return allocation.name;
        }
      }
    }

    return "Без категории";
  }

  root.calculateIncomePlan = function(profile,income,date){
    return core.planIncome(
      profile,
      income,
      date,
      profile && profile.transactions
    );
  };

  root.validatePlan = function(plan){
    return core.validatePlan(plan);
  };

  root.createIncomeTransaction = function(profile,data){
    const date = data.date || today();

    const tx = core.createIncomeTransaction({
      id:uid(),
      total:data.amount,
      date,
      month:monthKey(date),
      currency:data.currency || profile.settings.currency,
      source:String(data.source || "").trim(),
      note:String(data.note || "").trim(),
      allocations:clone(data.allocations || []),
      reserve:data.reserve || 0
    });

    tx.createdAt = new Date().toISOString();
    profile.transactions.push(tx);

    return tx;
  };

  root.monthStats = function(profile,month){
    const stats = core.monthStats(profile,month);
    const allocations = {};

    for(const [id,value] of Object.entries(stats.categoryBalances)){
      const name = categoryName(profile,id);
      allocations[name] = (allocations[name] || 0) + value;
    }

    allocations["Свободные деньги"] = stats.free;

    return {
      income:stats.income,
      expenses:stats.expenses,
      reserve:stats.reserve,
      allocations,
      operations:stats.operationCount,
      free:stats.free,
      uncontrolled:stats.uncontrolled
    };
  };

  root.updateIncomePlanUI = function(plan){
    currentIncomePlan = clone(plan);

    const data = readIncomePlanFromUI();
    const validation = core.validatePlan({
      total:plan.total,
      allocations:data.allocations,
      reserve:data.reserve
    });

    const currency = document.getElementById(
      "incomeCurrency"
    ).value;

    const differenceEl = document.getElementById(
      "planDifference"
    );

    if(differenceEl){
      differenceEl.textContent = money(
        validation.valid
          ? validation.remainder
          : validation.difference,
        currency
      );

      differenceEl.className =
        "value " +
        (validation.valid ? "positive" : "negative");
    }

    const message = document.getElementById(
      "planMessage"
    );

    if(!message){
      return;
    }

    if(!validation.valid){
      message.innerHTML = `
        <div class="notice danger">
          Ты распределил больше дохода на
          <strong>${money(Math.abs(validation.difference),currency)}</strong>.
        </div>
      `;
      return;
    }

    if(validation.remainder>0){
      message.innerHTML = `
        <div class="notice">
          В «Свободные деньги» перейдёт
          <strong>${money(validation.remainder,currency)}</strong>.
          Можно сохранять.
        </div>
      `;
      return;
    }

    message.innerHTML = `
      <div class="notice">
        Распределение сходится. Можно сохранять.
      </div>
    `;
  };

  if(typeof root.render === "function"){
    root.render();
  }
})(typeof globalThis!=="undefined" ? globalThis : window);
