import admin from 'firebase-admin';

admin.initializeApp();

async function setAdminPassword() {
  const email = 'amanuelyohannes929@gmail.com';
  const password = 'yamawa2025';
  
  try {
    let userRecord;
    try {
      userRecord = await admin.auth().getUserByEmail(email);
      console.log('User found, updating password...');
      await admin.auth().updateUser(userRecord.uid, {
        password: password
      });
      console.log('Password updated successfully.');
    } catch (error: any) {
      if (error.code === 'auth/user-not-found') {
        console.log('User not found, creating user...');
        userRecord = await admin.auth().createUser({
          email: email,
          password: password,
          emailVerified: true
        });
        console.log('User created successfully.');
      } else {
        throw error;
      }
    }

    // Now update Firestore
    const db = admin.firestore();
    const userRef = db.collection('users').doc(userRecord.uid);
    await userRef.set({
      uid: userRecord.uid,
      email: email,
      role: 'superadmin',
      displayName: 'Admin'
    }, { merge: true });
    
    console.log('Firestore user document updated with superadmin role.');
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    process.exit(0);
  }
}

setAdminPassword();
