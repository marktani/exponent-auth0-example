import Exponent from 'exponent';
import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  Button,
  Linking,
} from 'react-native';
import jwtDecoder from 'jwt-decode';
import ApolloClient, { createNetworkInterface } from 'apollo-client';
import gql from 'graphql-tag';


const redirect_uri = 'exp://xz-5yt.marktani.exponent-auth0.exp.direct/+/redirect';
const auth0_client_id = 'wtDi2d3hieLqDNThpXmFuuoxcbF4bV3d';
const authorize_url = 'https://marktani.eu.auth0.com/authorize';


class App extends React.Component {
  state = {
    username: undefined,
    counter: undefined,
  };
  componentDidMount() {
    Linking.addEventListener('url', this._handleAuth0Redirect);
  }

  _logout = () => {
    this.setState({
      username: undefined,
      counter: undefined
    })
  }

  _loginWithAuth0 = async () => {
    const redirectionURL = authorize_url + this._toQueryString({
      client_id: auth0_client_id,
      response_type: 'token',
      scope: 'openid name',
      redirect_uri,
      state: redirect_uri,
    });
    Exponent.WebBrowser.openBrowserAsync(redirectionURL);
  }

  _handleAuth0Redirect = async (event) => {
    if (!event.url.includes('+/redirect')) {
      return;
    }
    Exponent.WebBrowser.dismissBrowser();
    const [, queryString] = event.url.split('#');
    const responseObj = queryString.split('&').reduce((map, pair) => {
      const [key, value] = pair.split('=');
      map[key] = value; // eslint-disable-line
      return map;
    }, {});
    const encodedToken = responseObj.id_token;
    const decodedToken = jwtDecoder(encodedToken);
    const username = decodedToken.name;

    const networkInterface = createNetworkInterface({ uri: 'https://api.graph.cool/simple/v1/ciz5w00wk16gn0109n00jsel4' })

    networkInterface.use([{
      applyMiddleware(req, next) {
        if (!req.options.headers) {
          req.options.headers = {};  // Create the header object if needed.
        }
        req.options.headers['authorization'] = `Bearer ${encodedToken}`;
        next();
      }
    }]);

    const client = new ApolloClient({
      networkInterface
    });

    // check if a user is already logged in
    const userResult = await client.query({
      query: gql`{
        user {
          id
          counter
        }
      }`
    })

    if (!userResult.data.user) {
      // need to create user
      await client.mutate({mutation: gql`mutation {
        createUser(
          authProvider: {
            auth0: {
              idToken: "${encodedToken}"
            }
          }
          name: "${username}"
          counter: 1
        ) {
          id
        }
      }`})
      this.setState({ counter: 1, username })
    } else {
      const increaseCounter = await client.mutate({mutation: gql`mutation {
        updateUser(
          id: "${userResult.data.user.id}"
          counter: ${userResult.data.user.counter + 1}
        ) {
          counter
        }
      }`})
      this.setState({ counter: increaseCounter.data.updateUser.counter, username })
    }


  }

  /**
   * Converts an object to a query string.
   */
  _toQueryString(params) {
    return '?' + Object.entries(params)
      .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
      .join('&');
  }

  render() {
    return (
      <View style={styles.container}>
        {this.state.username !== undefined ?
          <View>
            <Text style={styles.title}>Hi {this.state.username}, you logged in {this.state.counter} times!</Text>
            <Button title="Logout" onPress={this._logout} />
          </View> :

          <View>
            <Text style={styles.title}>Example: Auth0 login</Text>
            <Button title="Login with Auth0" onPress={this._loginWithAuth0} />

          </View>
        }
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 20,
    textAlign: 'center',
    marginTop: 40,
  },
});

Exponent.registerRootComponent(App);
