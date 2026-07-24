const getUserNotificationPreferences = async (id, type) => {
    const Model = type === 'Customer' ? Customer : Employee;
    const user = await Model.findById(id);
    return user?.preferences?.notifications || {};
  };