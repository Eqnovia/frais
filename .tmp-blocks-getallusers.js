  function getAllAuditUsers() {
    var userMap = {};
    try {
      var fn = (typeof getSortedUsers === 'function') ? getSortedUsers : (window.getSortedUsers || null);
      if (typeof fn === 'function') {
        fn(false).forEach(function (pair) {
          if (pair && pair[0]) userMap[pair[0]] = (pair[1] && pair[1].label) || pair[0];
        });
      }
    } catch (e) {}

    try {
      var uObj = (typeof USERS !== 'undefined' && USERS) ? USERS : (window.USERS || null);
      if (uObj && typeof uObj === 'object') {
        Object.keys(uObj).forEach(function (k) {
          if (!userMap[k]) userMap[k] = (uObj[k] && uObj[k].label) || k;
        });
      }
    } catch (e) {}

    try {
      var raw = localStorage.getItem('eqnovia_users_v1');
      if (raw) {
        var parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          Object.keys(parsed).forEach(function (k) {
            if (!userMap[k]) userMap[k] = (parsed[k] && parsed[k].label) || k;
          });
        }
      }
    } catch (e) {}

    try {
      auditLoadLocal().forEach(function (l) {
        if (l && l.user && l.user !== '—' && !userMap[l.user]) {
          userMap[l.user] = userLabel(l.user);
        }
      });
    } catch (e) {}

    return userMap;
  }

